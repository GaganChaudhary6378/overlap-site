import XCTest
@testable import OverlapMac

final class ConnectionTests: XCTestCase {
    func testCredentialDestinationValidation() throws {
        XCTAssertEqual(try validatedBaseURL("https://demo.supabase.co").host, "demo.supabase.co")
        XCTAssertNoThrow(try validatedBaseURL("http://localhost:54321"))
        for value in ["http://demo.supabase.co", "https://user:password@demo.supabase.co", "https://demo.supabase.co?redirect=evil", "https://demo.supabase.co/path", "file:///tmp/config"] {
            XCTAssertThrowsError(try validatedBaseURL(value), value)
        }
    }
    func testInclusiveOverlapAcrossPeople() {
        let first: [String: Any] = ["user_id": "alice", "file_path": "login.ts", "start_line": 40, "end_line": 80]
        let touching: [String: Any] = ["user_id": "bob", "file_path": "login.ts", "start_line": 80, "end_line": 90]
        XCTAssertTrue(claimsOverlap(first, touching))
        var separate = touching
        separate["start_line"] = 81
        XCTAssertFalse(claimsOverlap(first, separate))
        separate = touching
        separate["user_id"] = "alice"
        XCTAssertFalse(claimsOverlap(first, separate))
        separate = touching
        separate["file_path"] = "other.ts"
        XCTAssertFalse(claimsOverlap(first, separate))
    }
    func testWidgetCacheContainsOnlySummary() throws {
        let summary = RoomSummary(roomName: "Test room", memberCount: 2, claimCount: 1, conflictCount: 0, updatedAt: Date())
        let data = try JSONEncoder().encode(summary)
        XCTAssertEqual(try JSONDecoder().decode(RoomSummary.self, from: data), summary)
        let fields = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(Set(fields.keys), ["roomName", "memberCount", "claimCount", "conflictCount", "updatedAt"])
    }
}
