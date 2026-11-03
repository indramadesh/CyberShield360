// CyberShield360 SMS filter (iOS 16+). NOT BUILT OR TESTED YET: needs a Mac with Xcode.
//
// iOS asks this extension about SMS/MMS from UNKNOWN senders only (never contacts,
// never iMessage). The extension can't use the network itself: it defers to the
// system, which POSTs {"_version":1,"query":{"sender":…,"message":{"text":…}}} to the
// URL in Info.plist (ILMessageFilterExtensionNetworkURL) — our stateless endpoint
// /api/v1/msgintel/ios/message-filter — and hands the reply back here.
import IdentityLookup

final class MessageFilterExtension: ILMessageFilterExtension {}

extension MessageFilterExtension: ILMessageFilterQueryHandling {
    func handle(_ queryRequest: ILMessageFilterQueryRequest,
                context: ILMessageFilterExtensionContext,
                completion: @escaping (ILMessageFilterQueryResponse) -> Void) {
        // No on-device detection: CyberShield360 has one engine, on the server.
        context.deferQueryRequestToNetwork { networkResponse, error in
            let response = ILMessageFilterQueryResponse()
            response.action = .none // on any failure, let the message through unfiltered
            if error == nil, let data = networkResponse?.data,
               let http = networkResponse?.urlResponse, http.statusCode == 200,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let action = json["action"] as? String {
                switch action {
                case "junk": response.action = .junk
                case "promotion": response.action = .promotion
                case "transaction": response.action = .transaction
                default: response.action = .none
                }
            }
            completion(response)
        }
    }
}
