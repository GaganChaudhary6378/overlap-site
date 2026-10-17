import Foundation
import Security

// Secret payload travels over stdin/stdout, never process arguments or repo files.
let operation = CommandLine.arguments.dropFirst().first ?? ""
let account = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "chatgpt"
let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "dev.overlap.local", kSecAttrAccount as String: account]
var status: OSStatus = errSecSuccess
switch operation {
case "read":
    var lookup = query
    lookup[kSecReturnData as String] = true
    lookup[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    status = SecItemCopyMatching(lookup as CFDictionary, &result)
    if status == errSecItemNotFound { exit(0) }
    if status == errSecSuccess, let data = result as? Data { FileHandle.standardOutput.write(data) }
case "write":
    let data = FileHandle.standardInput.readDataToEndOfFile()
    status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if status == errSecItemNotFound {
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        status = SecItemAdd(item as CFDictionary, nil)
    }
case "delete":
    status = SecItemDelete(query as CFDictionary)
    if status == errSecItemNotFound { status = errSecSuccess }
default: exit(2)
}
if status != errSecSuccess {
    FileHandle.standardError.write(Data("Keychain operation failed (\(status)).\n".utf8))
    exit(1)
}
