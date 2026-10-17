import AppKit
import SwiftUI

@main struct OverlapMac: App {
    @StateObject private var store = RoomStore()

    init() {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    var body: some Scene {
        WindowGroup("Overlap — Signal Office", id: "room") { RoomPanel(store: store) }
            .defaultSize(width: 440, height: 640)
        MenuBarExtra("Overlap", systemImage: "antenna.radiowaves.left.and.right") {
            OpenPanel()
            Divider()
            Button("Quit Overlap") { NSApplication.shared.terminate(nil) }
        }
    }
}

struct OpenPanel: View {
    @Environment(\.openWindow) private var openWindow
    var body: some View {
        Button("Open room panel") {
            openWindow(id: "room")
            NSApplication.shared.activate(ignoringOtherApps: true)
        }
    }
}

struct RoomPanel: View {
    @ObservedObject var store: RoomStore
    @State private var floating = true
    @State private var settingsExpanded = true
    @FocusState private var focusedField: ConnectionField?
    private let ink = Color(red: 0.17, green: 0.19, blue: 0.23)
    private let brass = Color(red: 0.52, green: 0.39, blue: 0.20)
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Text("OVERLAP").font(.system(size: 14, weight: .bold, design: .monospaced)).tracking(4)
                    Spacer()
                    Circle().fill(store.online ? Color.green : brass).frame(width: 8, height: 8)
                    Text(store.online ? "LIVE ROOM" : "OFFLINE").font(.system(size: 10, design: .monospaced))
                }
                Rectangle().fill(ink).frame(height: 2)
                Text(store.summary?.roomName ?? "The signal office.")
                    .font(.custom("Georgia", size: 34))
                Text("ONE ROOM. EVERY AGENT IN VIEW.")
                    .font(.system(size: 10, design: .monospaced)).tracking(1.3).foregroundStyle(brass)
                if let summary = store.summary {
                    HStack(spacing: 28) {
                        metric("MEMBERS", summary.memberCount)
                        metric("CLAIMS", summary.claimCount)
                        metric("WARNINGS", summary.conflictCount)
                    }
                    Divider()
                    if store.claims.isEmpty {
                        Text("The tracks are clear.").font(.custom("Georgia", size: 21))
                        Text("No active editing claims in this room.").font(.callout)
                    }
                    ForEach(store.claims) { claim in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Image(systemName: claim.conflict ? "exclamationmark.triangle.fill" : "circle.fill")
                                    .foregroundStyle(claim.conflict ? Color.red : brass)
                                Text(claim.file).font(.system(.callout, design: .monospaced)).lineLimit(2)
                            }
                            Text("\(claim.owner) · lines \(claim.start)–\(claim.end)").font(.caption)
                        }.padding(12).frame(maxWidth: .infinity, alignment: .leading)
                            .overlay(Rectangle().stroke(brass.opacity(0.4), lineWidth: 1))
                    }
                    if let updated = store.lastUpdate {
                        Text("Last received \(updated.formatted(date: .omitted, time: .standard))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                Text(store.status).font(.callout).textSelection(.enabled)
                DisclosureGroup("Connection settings", isExpanded: $settingsExpanded) {
                    VStack(spacing: 10) {
                        TextField("Supabase URL", text: $store.baseURL)
                            .focused($focusedField, equals: .baseURL)
                        TextField("Supabase publishable / anon key", text: $store.publicKey)
                            .focused($focusedField, equals: .publicKey)
                        TextField("Room UUID", text: $store.roomID)
                            .focused($focusedField, equals: .roomID)
                        if !store.signedIn {
                            TextField("Your email", text: $store.email)
                                .focused($focusedField, equals: .email)
                            Button("Send sign-in code") { store.perform { try await store.sendCode() } }
                            TextField("Email code", text: $store.code)
                                .focused($focusedField, equals: .code)
                            Button("Verify code") { store.perform { try await store.verify() } }
                        }
                        HStack {
                            Button("Connect / refresh") { store.perform { try await store.poll() } }.disabled(!store.signedIn)
                            if store.signedIn { Button("Sign out") { store.disconnect() } }
                        }
                        Text("Join this room in the web app first. This signs in to room sync; your ChatGPT connection stays in the local bridge.")
                            .font(.caption).foregroundStyle(.secondary)
                    }.textFieldStyle(.roundedBorder).padding(.top, 10).disabled(store.busy)
                }
                Toggle("Keep panel above other windows", isOn: $floating).font(.caption)
                    .background(WindowLevel(floating: floating))
                Text("Shared activity is advisory. Code sync uses Git.").font(.caption).foregroundStyle(brass)
            }.padding(26)
        }
        .foregroundStyle(ink)
        .background(Color(red: 0.956, green: 0.941, blue: 0.902))
        .frame(minWidth: 380, minHeight: 540)
        .preferredColorScheme(.light)
        .onOpenURL { _ in NSApplication.shared.activate(ignoringOtherApps: true) }
        .onAppear {
            NSApplication.shared.setActivationPolicy(.regular)
            NSApplication.shared.activate(ignoringOtherApps: true)
            NSApplication.shared.windows
                .first(where: { $0.title.contains("Signal Office") })?
                .makeKeyAndOrderFront(nil)
            focusedField = .baseURL
        }
        .task {
            store.restore()
            while !Task.isCancelled {
                if store.signedIn && !store.roomID.isEmpty && !store.busy {
                    store.perform { try await store.poll() }
                }
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }
    private enum ConnectionField: Hashable {
        case baseURL, publicKey, roomID, email, code
    }

    private func metric(_ label: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(value.formatted()).font(.custom("Georgia", size: 28))
            Text(label).font(.system(size: 9, design: .monospaced)).foregroundStyle(brass)
        }
    }
}

struct WindowLevel: NSViewRepresentable {
    var floating: Bool
    func makeNSView(context: Context) -> NSView { NSView() }
    func updateNSView(_ view: NSView, context: Context) {
        DispatchQueue.main.async { view.window?.level = floating ? .floating : .normal }
    }
}
