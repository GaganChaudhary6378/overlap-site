import Foundation
import Security
import SwiftUI
import WidgetKit

struct Session: Codable {
    let access_token: String
    let refresh_token: String
    let expires_at: Double?
}

final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

@MainActor final class RoomStore: ObservableObject {
    private let transport = URLSession(configuration: .ephemeral, delegate: NoRedirects(), delegateQueue: nil)
    @Published var baseURL = UserDefaults.standard.string(forKey: "supabaseURL") ?? ""
    @Published var publicKey = UserDefaults.standard.string(forKey: "supabasePublicKey") ?? ""
    @Published var roomID = UserDefaults.standard.string(forKey: "roomID") ?? ""
    @Published var email = ""
    @Published var code = ""
    @Published var status = "Connect your shared room."
    @Published var signedIn = false
    @Published var busy = false
    @Published var summary: RoomSummary?
    @Published var claims: [RoomClaim] = []
    @Published var lastUpdate: Date?
    @Published var online = false
    private var session: Session?
    private var sessionOrigin: String?

    func perform(_ operation: @escaping @MainActor () async throws -> Void) {
        guard !busy else { return }
        busy = true
        Task {
            defer { busy = false }
            do { try await operation() }
            catch { status = error.localizedDescription; online = false }
        }
    }

    func restore() {
        do {
            let origin = try validatedBaseURL(baseURL).absoluteString
            session = try readSession(origin)
            sessionOrigin = origin
            signedIn = session != nil
        } catch { status = error.localizedDescription }
    }

    func sendCode() async throws {
        _ = try await request("auth/v1/otp", ["email": email, "create_user": true], authenticated: false)
        status = "Email sent. Paste the email code below."
    }

    func verify() async throws {
        let data = try await request("auth/v1/verify", ["email": email, "token": code, "type": "email"], authenticated: false)
        let value = try JSONDecoder().decode(Session.self, from: data)
        try saveSession(value)
        code = ""
        status = "Signed in. Join a room in the web dashboard, then paste its UUID."
    }

    func disconnect() {
        if let origin = sessionOrigin {
            let result = SecItemDelete(keychainQuery(origin) as CFDictionary)
            guard result == errSecSuccess || result == errSecItemNotFound else {
                status = ServiceError.keychain(result).localizedDescription
                return
            }
        }
        session = nil
        signedIn = false
        sessionOrigin = nil
        summary = nil
        claims = []
        online = false
        lastUpdate = nil
        if let url = RoomSummary.cacheURL() { try? FileManager.default.removeItem(at: url) }
        WidgetCenter.shared.reloadTimelines(ofKind: RoomSummary.widgetKind)
        status = "Signed out on this Mac."
    }

    func poll() async throws {
        guard UUID(uuidString: roomID) != nil else { throw ServiceError.invalidRoom }
        guard session != nil else { throw ServiceError.missingSession }
        _ = try await request("rest/v1/rpc/heartbeat", ["p_room_id": roomID])
        let data = try await request("rest/v1/rpc/room_snapshot", ["p_room_id": roomID])
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let room = object["room"] as? [String: Any],
              let members = object["members"] as? [[String: Any]],
              let values = object["claims"] as? [[String: Any]] else { throw ServiceError.invalidResponse }
        claims = values.map { item in
            RoomClaim(id: item["id"] as? String ?? UUID().uuidString,
                      file: item["file_path"] as? String ?? "Unknown file",
                      start: item["start_line"] as? Int ?? 0, end: item["end_line"] as? Int ?? 0,
                      owner: item["display_name"] as? String ?? "Room member",
                      conflict: values.contains { claimsOverlap(item, $0) })
        }
        let next = RoomSummary(roomName: room["name"] as? String ?? "Shared room", memberCount: members.count,
                               claimCount: claims.count, conflictCount: claims.filter(\.conflict).count, updatedAt: Date())
        let changed = summary?.roomName != next.roomName || summary?.memberCount != next.memberCount || summary?.claimCount != next.claimCount || summary?.conflictCount != next.conflictCount
        summary = next
        lastUpdate = next.updatedAt
        online = true
        status = "Connected. Room activity refreshes every 5 seconds."
        UserDefaults.standard.set(baseURL, forKey: "supabaseURL")
        UserDefaults.standard.set(publicKey, forKey: "supabasePublicKey")
        UserDefaults.standard.set(roomID, forKey: "roomID")
        if let url = RoomSummary.cacheURL() {
            try JSONEncoder().encode(next).write(to: url, options: .atomic)
            if changed { WidgetCenter.shared.reloadTimelines(ofKind: RoomSummary.widgetKind) }
        }
    }

    private func request(_ path: String, _ body: [String: Any], authenticated: Bool = true, retry: Bool = true) async throws -> Data {
        let base = try validatedBaseURL(baseURL)
        if authenticated {
            guard sessionOrigin == base.absoluteString, session != nil else { throw ServiceError.missingSession }
            if retry, let expiry = session?.expires_at, expiry < Date().timeIntervalSince1970 + 60 {
                try await refresh()
            }
        }
        var request = URLRequest(url: base.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(publicKey, forHTTPHeaderField: "apikey")
        if authenticated, let token = session?.access_token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await transport.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw ServiceError.invalidResponse }
        if response.statusCode == 401 && authenticated && retry {
            try await refresh()
            return try await self.request(path, body, retry: false)
        }
        guard (200...299).contains(response.statusCode) else { throw ServiceError.denied(response.statusCode) }
        return data
    }

    private func refresh() async throws {
        guard let token = session?.refresh_token else { throw ServiceError.missingSession }
        // Query is fixed here; never accept an arbitrary credential destination.
        let base = try validatedBaseURL(baseURL)
        guard sessionOrigin == base.absoluteString else { throw ServiceError.missingSession }
        var request = URLRequest(url: base.appendingPathComponent("auth/v1/token").appending(queryItems: [URLQueryItem(name: "grant_type", value: "refresh_token")]))
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue(publicKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": token])
        let (data, response) = try await transport.data(for: request)
        guard let response = response as? HTTPURLResponse, (200...299).contains(response.statusCode) else { throw ServiceError.missingSession }
        try saveSession(JSONDecoder().decode(Session.self, from: data))
    }

    private func keychainQuery(_ origin: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "dev.overlap.room-session", kSecAttrAccount as String: origin]
    }

    private func readSession(_ origin: String) throws -> Session? {
        var query = keychainQuery(origin)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw ServiceError.keychain(status) }
        return try JSONDecoder().decode(Session.self, from: data)
    }

    private func saveSession(_ value: Session) throws {
        let origin = try validatedBaseURL(baseURL).absoluteString
        let query = keychainQuery(origin)
        let data = try JSONEncoder().encode(value)
        var status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var new = query
            new[kSecValueData as String] = data
            new[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            status = SecItemAdd(new as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw ServiceError.keychain(status) }
        UserDefaults.standard.set(baseURL, forKey: "supabaseURL")
        UserDefaults.standard.set(publicKey, forKey: "supabasePublicKey")
        session = value
        sessionOrigin = origin
        signedIn = true
    }
}
