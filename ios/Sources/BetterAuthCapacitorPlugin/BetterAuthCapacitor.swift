import Foundation
import AuthenticationServices

public enum AuthSessionError: Error {
    case userCanceled
    case authFailed(String)
    case noCallbackURL

    var localizedDescription: String {
        switch self {
        case .userCanceled:
            return "User canceled the auth session"
        case .authFailed(let message):
            return message
        case .noCallbackURL:
            return "No callback URL received"
        }
    }

    var code: String {
        switch self {
        case .userCanceled:
            return "USER_CANCELED"
        case .authFailed:
            return "AUTH_FAILED"
        case .noCallbackURL:
            return "NO_CALLBACK"
        }
    }
}

public class BetterAuthCapacitor: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var presentationAnchor: ASPresentationAnchor?

    public func openAuthSession(
        url: URL,
        callbackURLScheme: String,
        presentationAnchor: ASPresentationAnchor,
        completion: @escaping (Result<URL, AuthSessionError>) -> Void
    ) {
        self.presentationAnchor = presentationAnchor

        let authSession = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: callbackURLScheme
        ) { callbackURL, error in
            if let error = error as? ASWebAuthenticationSessionError,
               error.code == .canceledLogin {
                completion(.failure(.userCanceled))
                return
            }
            if let error = error {
                completion(.failure(.authFailed(error.localizedDescription)))
                return
            }
            guard let callbackURL = callbackURL else {
                completion(.failure(.noCallbackURL))
                return
            }
            completion(.success(callbackURL))
        }

        authSession.presentationContextProvider = self
        authSession.prefersEphemeralWebBrowserSession = true
        authSession.start()
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return presentationAnchor ?? ASPresentationAnchor()
    }
}
