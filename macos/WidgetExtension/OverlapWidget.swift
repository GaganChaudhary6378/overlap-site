import SwiftUI
import WidgetKit

struct RoomEntry: TimelineEntry {
    let date: Date
    let summary: RoomSummary?
}

struct RoomProvider: TimelineProvider {
    func placeholder(in context: Context) -> RoomEntry { RoomEntry(date: Date(), summary: nil) }
    func getSnapshot(in context: Context, completion: @escaping (RoomEntry) -> Void) {
        completion(RoomEntry(date: Date(), summary: RoomSummary.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<RoomEntry>) -> Void) {
        let entry = RoomEntry(date: Date(), summary: RoomSummary.read())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900))))
    }
}

struct RoomWidgetView: View {
    let entry: RoomEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("OVERLAP · SIGNAL OFFICE").font(.system(size: 10, weight: .bold, design: .monospaced))
            Divider()
            if let room = entry.summary {
                Text(room.roomName).font(.custom("Georgia", size: 22)).lineLimit(1)
                Text("\(room.memberCount) members · \(room.claimCount) claims")
                Text(room.conflictCount > 0 ? "\(room.conflictCount) overlap warnings" : "Tracks clear at last update")
                    .foregroundStyle(room.conflictCount > 0 ? .red : Color(red: 0.52, green: 0.39, blue: 0.20))
                HStack {
                    Text("Updated")
                    Text(room.updatedAt, style: .relative)
                }.font(.caption)
                if entry.date.timeIntervalSince(room.updatedAt) > 60 {
                    Text("Open Overlap for current activity.").font(.caption)
                }
            } else {
                Text("Connect your room.").font(.custom("Georgia", size: 24))
                Text("Open Overlap on this Mac to sign in.").font(.caption)
            }
        }
        .font(.callout)
        .foregroundStyle(Color(red: 0.17, green: 0.19, blue: 0.23))
        .containerBackground(Color(red: 0.956, green: 0.941, blue: 0.902), for: .widget)
        .widgetURL(URL(string: "overlap://room"))
    }
}

@main struct OverlapWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: RoomSummary.widgetKind, provider: RoomProvider()) { RoomWidgetView(entry: $0) }
            .configurationDisplayName("Overlap room")
            .description("The latest room summary received by your Mac.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
