import Foundation

func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else { fatalError(message) }
}

let productionURL = try validatedBaseURL("https://demo.supabase.co")
check(productionURL.host == "demo.supabase.co", "HTTPS URL rejected")
_ = try validatedBaseURL("http://localhost:54321")
for value in ["http://demo.supabase.co", "https://user:password@demo.supabase.co", "https://demo.supabase.co?redirect=evil", "https://demo.supabase.co/path", "file:///tmp/config"] {
    do {
        _ = try validatedBaseURL(value)
        fatalError("Unsafe URL accepted")
    } catch ServiceError.invalidURL { }
}
let first: [String: Any] = ["user_id": "alice", "file_path": "login.ts", "start_line": 40, "end_line": 80]
var second: [String: Any] = ["user_id": "bob", "file_path": "login.ts", "start_line": 80, "end_line": 90]
check(claimsOverlap(first, second), "Touching inclusive ranges must overlap")
second["start_line"] = 81
check(!claimsOverlap(first, second), "Separate ranges must not overlap")
second["start_line"] = 60
second["user_id"] = "alice"
check(!claimsOverlap(first, second), "Same user's claims must not warn")
second["user_id"] = "bob"
second["file_path"] = "other.ts"
check(!claimsOverlap(first, second), "Different files must not overlap")
let summary = RoomSummary(roomName: "Test room", memberCount: 2, claimCount: 1, conflictCount: 0, updatedAt: Date())
let encoded = try JSONEncoder().encode(summary)
let decoded = try JSONDecoder().decode(RoomSummary.self, from: encoded)
check(decoded == summary, "Summary must round-trip")
let fields = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
check(Set(fields.keys) == ["roomName", "memberCount", "claimCount", "conflictCount", "updatedAt"], "Widget cache may contain only sanitized fields")
print("Native checks passed: URL safety, inclusive overlaps, widget cache schema.")
