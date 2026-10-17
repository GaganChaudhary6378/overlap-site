// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "OverlapMac",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "OverlapMac", targets: ["OverlapMac"])],
    targets: [
        .executableTarget(name: "OverlapMac"),
        .testTarget(name: "OverlapMacTests", dependencies: ["OverlapMac"])
    ]
)
