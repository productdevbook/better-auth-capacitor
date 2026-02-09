import Foundation
import Capacitor

@objc(BetterAuthCapacitorPlugin)
public class BetterAuthCapacitorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BetterAuthCapacitorPlugin"
    public let jsName = "BetterAuthCapacitor"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openAuthSession", returnType: CAPPluginReturnPromise)
    ]

    private let implementation = BetterAuthCapacitor()

    @objc func openAuthSession(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let redirectScheme = call.getString("redirectScheme"),
              let url = URL(string: urlString) else {
            call.reject("Missing url or redirectScheme")
            return
        }

        DispatchQueue.main.async {
            self.implementation.openAuthSession(
                url: url,
                callbackURLScheme: redirectScheme,
                presentationAnchor: self.bridge?.webView?.window ?? UIWindow()
            ) { result in
                switch result {
                case .success(let callbackURL):
                    call.resolve(["url": callbackURL.absoluteString])
                case .failure(let error):
                    call.reject(error.localizedDescription, error.code)
                }
            }
        }
    }
}
