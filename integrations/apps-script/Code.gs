// Paste into a standalone Apps Script project owned by the dedicated BlueMoon Gmail account.
function hex(bytes) { return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function mac(payload, timestamp, nonce, secret) {
  return hex(Utilities.computeHmacSha256Signature(timestamp + '\n' + nonce + '\n' + payload, secret, Utilities.Charset.UTF_8));
}
function secureEqual(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  var difference = 0;
  for (var i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function signed(data, secret) {
  var payload = JSON.stringify(data), timestamp = Date.now(), nonce = Utilities.getUuid();
  return {payload: payload, timestamp: timestamp, nonce: nonce, signature: mac(payload, timestamp, nonce, secret)};
}
function response(data, secret) {
  return ContentService.createTextOutput(JSON.stringify(signed(data, secret))).setMimeType(ContentService.MimeType.JSON);
}
function doPost(event) {
  var properties = PropertiesService.getScriptProperties(), secret = properties.getProperty('BRIDGE_SECRET') || '';
  var id = '', lock = LockService.getScriptLock(), locked = false;
  try {
    if (secret.length < 32) throw new Error('Bridge chưa được cấu hình');
    var envelope = JSON.parse(event.postData.contents);
    if (typeof envelope.payload !== 'string' || envelope.payload.length > 200000 || !Number.isSafeInteger(envelope.timestamp) || Math.abs(Date.now() - envelope.timestamp) > 300000 || typeof envelope.nonce !== 'string' || !/^[a-zA-Z0-9_-]{5,128}$/.test(envelope.nonce) || !secureEqual(envelope.signature, mac(envelope.payload, envelope.timestamp, envelope.nonce, secret))) throw new Error('Chữ ký hoặc thời hạn không hợp lệ');
    var data = JSON.parse(envelope.payload);id = String(data.id || '');
    if (data.action !== 'send' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || typeof data.to !== 'string' || typeof data.subject !== 'string' || data.subject.length > 300 || typeof data.body !== 'string') throw new Error('Yêu cầu không hợp lệ');
    var recipients = (properties.getProperty('EMAIL_ALLOWLIST') || '').split(',').map(function (s) {return s.trim().toLowerCase();});
    if (!data.to || /[,;\s]/.test(data.to) || recipients.indexOf(data.to.toLowerCase()) < 0) throw new Error('Người nhận chưa có trong danh sách thử nghiệm');
    lock.waitLock(10000);locked = true;
    var nonceKey = 'nonce:' + envelope.nonce;
    if (properties.getProperty(nonceKey)) throw new Error('Nonce đã dùng');
    var all = properties.getProperties();
    Object.keys(all).forEach(function (key) {if (key.indexOf('nonce:') === 0 && Number(all[key]) < Date.now() - 600000) properties.deleteProperty(key);});
    properties.setProperty(nonceKey, String(Date.now()));
    var sheet = SpreadsheetApp.openById(properties.getProperty('JOURNAL_ID')).getSheets()[0];
    var digest = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([data.to, data.subject, data.body]), Utilities.Charset.UTF_8));
    var found = sheet.getRange(1, 1, sheet.getLastRow(), 1).createTextFinder(id).matchEntireCell(true).findNext();
    var row = found ? found.getRow() : sheet.getLastRow() + 1;
    if (found) {
      var previous = sheet.getRange(row, 1, 1, 5).getValues()[0];
      if (previous[1] !== digest) throw new Error('Mã thông báo đã được dùng cho nội dung khác');
      if (previous[2] === 'ACCEPTED') return response({id: id, status: 'ACCEPTED'}, secret);
      if (previous[2] === 'SENDING' || previous[2] === 'UNKNOWN') return response({id: id, status: 'UNKNOWN', error: 'Cần kiểm tra thư đã gửi trước khi thử lại'}, secret);
    }
    if (MailApp.getRemainingDailyQuota() < 1) {
      sheet.getRange(row, 1, 1, 5).setValues([[id, digest, 'QUOTA', new Date().toISOString(), 'Hết hạn mức email']]);
      return response({id: id, status: 'QUOTA'}, secret);
    }
    // Persist intent before the irreversible mail call; uncertain outcomes never auto-resend.
    sheet.getRange(row, 1, 1, 5).setValues([[id, digest, 'SENDING', new Date().toISOString(), '']]);SpreadsheetApp.flush();
    var status = 'ACCEPTED', detail = '';
    try {MailApp.sendEmail({to: data.to, subject: data.subject, body: data.body + '\n\nMã thông báo: ' + id, name: 'BlueMoon'});}
    catch (error) {status = 'UNKNOWN';detail = 'Chưa rõ kết quả; kiểm tra thư đã gửi theo mã thông báo';}
    sheet.getRange(row, 1, 1, 5).setValues([[id, digest, status, new Date().toISOString(), detail]]);SpreadsheetApp.flush();
    return response({id: id, status: status, error: detail}, secret);
  } catch (error) {
    return response({id: id, status: 'REJECTED', error: 'Yêu cầu bị từ chối hoặc cấu hình chưa sẵn sàng'}, secret);
  } finally {if (locked) lock.releaseLock();}
}
function setupBridge() {
  var properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('JOURNAL_ID')) {
    var book = SpreadsheetApp.create('BlueMoon — Nhật ký gửi email');
    book.getSheets()[0].appendRow(['id', 'hash', 'status', 'updatedAt', 'detail']);
    properties.setProperty('JOURNAL_ID', book.getId());
  }
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {return trigger.getHandlerFunction() === 'runDaily';});
  if (!exists) ScriptApp.newTrigger('runDaily').timeBased().everyDays(1).atHour(8).inTimezone('Asia/Ho_Chi_Minh').create();
}
function runDaily() {
  var properties = PropertiesService.getScriptProperties(), appUrl = properties.getProperty('APP_URL') || '';
  if (!/^https:\/\//.test(appUrl)) throw new Error('APP_URL phải dùng HTTPS');
  var result = UrlFetchApp.fetch(appUrl.replace(/\/$/, '') + '/api/v1/internal/notifications', {method: 'post', contentType: 'application/json', payload: JSON.stringify(signed({action: 'process'}, properties.getProperty('BRIDGE_SECRET'))), muteHttpExceptions: true});
  if (result.getResponseCode() !== 200) throw new Error('Không xử lý được hàng đợi; HTTP ' + result.getResponseCode());
}
