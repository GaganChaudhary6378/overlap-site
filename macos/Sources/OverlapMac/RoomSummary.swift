import Foundation

// Include this file in both Xcode targets. The shared cache never contains credentials.
struct RoomSummary: Codable, Equatable {
    static let groupID = "group.dev.overlap.shared"
    static let widgetKind = "OverlapRoomWidget"
    let roomName: String
    let memberCount: Int
    let claimCount: Int
    let conflictCount: Int
    let updatedAt: Date

    static func cacheURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)?
            .appendingPathComponent("room-summary.json")
    }

    static func read() -> RoomSummary? {
        guard let url = cacheURL(), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Self.self, from: data)
    }
}

struct RoomClaim: Identifiable {
    let id: String
    let file: String
    let start: Int
    let end: Int
    let owner: String
    let conflict: Bool
}

enum ServiceError: LocalizedError {
    case invalidURL, invalidRoom, invalidResponse, denied(Int), missingSession, keychain(Int32)
    var errorDescription: String? {
        switch self {
        case .invalidURL: "Use an HTTPS Supabase URL, or HTTP localhost for development."
        case .invalidRoom: "Paste the room UUID from the web dashboard."
        case .invalidResponse: "The server returned an unreadable response."
        case .denied(let status): "Request failed (HTTP \(status)). Check sign-in and room membership."
        case .missingSession: "Sign in with the email you use for this room."
        case .keychain(let code): "Keychain could not save your session (\(code))."
        }
    }
}

func validatedBaseURL(_ text: String) throws -> URL {
    guard let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
          let host = url.host, url.user == nil, url.password == nil,
          url.query == nil, url.fragment == nil,
          url.path.isEmpty || url.path == "/",
          url.scheme == "https" || (url.scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host))
    else { throw ServiceError.invalidURL }
    return url
}

func claimsOverlap(_ first: [String: Any], _ second: [String: Any]) -> Bool {
    guard let owner = first["user_id"] as? String,
          let otherOwner = second["user_id"] as? String,
          owner != otherOwner,
          let file = first["file_path"] as? String,
          file == second["file_path"] as? String,
          let start = first["start_line"] as? Int,
          let end = first["end_line"] as? Int,
          let otherStart = second["start_line"] as? Int,
          let otherEnd = second["end_line"] as? Int else { return false }
    return start <= otherEnd && otherStart <= end
}
