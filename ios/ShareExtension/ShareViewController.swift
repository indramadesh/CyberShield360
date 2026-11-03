// "Share → Check with CyberShield360" for text the user chooses. NOT BUILT OR TESTED
// YET: needs a Mac with Xcode. Uses the device token the main app stored in the shared
// Keychain access group after pairing (same pairing code flow as Android).
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let label = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            label.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        label.text = "Checking…"
        loadSharedText { [weak self] text in
            guard let self else { return }
            guard let text, !text.isEmpty else { return self.finish("Nothing to check.") }
            guard let token = SharedKeychain.deviceToken() else {
                return self.finish("Open CyberShield360 and pair this iPhone first.")
            }
            self.check(text: String(text.prefix(8000)), token: token)
        }
    }

    private func loadSharedText(_ done: @escaping (String?) -> Void) {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem])?.flatMap { $0.attachments ?? [] } ?? []
        guard let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }) else {
            return done(nil)
        }
        p.loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, _ in
            DispatchQueue.main.async { done(item as? String) }
        }
    }

    private func check(text: String, token: String) {
        var req = URLRequest(url: SharedKeychain.serverURL().appendingPathComponent("api/v1/msgintel/device/events"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(token, forHTTPHeaderField: "X-Device-Token")
        let item: [String: Any] = ["source_type": "shared_text", "app": "ios-share", "text": text, "complete": true]
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["items": [item]])
        URLSession.shared.dataTask(with: req) { [weak self] data, _, error in
            var message = "Couldn't reach CyberShield360."
            if error == nil, let data,
               let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let results = (body["data"] as? [String: Any])?["results"] as? [[String: Any]],
               let r = results.first {
                if r["accepted"] as? Bool == true {
                    let headline = r["headline"] as? String ?? "No warning signs found. That doesn't prove it's safe."
                    message = "\(r["classification"] ?? "") · \(r["risk_level"] ?? "")\n\n\(headline)"
                } else {
                    message = r["message"] as? String ?? "Not accepted."
                }
            }
            DispatchQueue.main.async { self?.finish(message) }
        }.resume()
    }

    private func finish(_ message: String) {
        label.text = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        }
    }
}

/// Device token + server URL in the Keychain group shared by the app and its extensions.
enum SharedKeychain {
    static let group = "group.com.cybershield360.protect" // set your team's access group in Xcode
    static let defaultServer = URL(string: "https://cybershield360-ae6b.onrender.com")!

    static func serverURL() -> URL {
        UserDefaults(suiteName: group)?.string(forKey: "server").flatMap(URL.init(string:)) ?? defaultServer
    }

    static func deviceToken() -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "cs360",
                                kSecAttrAccount as String: "device-token", kSecAttrAccessGroup as String: group,
                                kSecReturnData as String: true]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
}
