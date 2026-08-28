import AppKit
import Foundation
import UserNotifications

private let retryAction = "RETRY_SYNC"
private let failureCategory = "SYNC_FAILURE"

@main
final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    private let center = UNUserNotificationCenter.current()

    func applicationDidFinishLaunching(_ notification: Notification) {
        center.delegate = self
        center.setNotificationCategories([
            UNNotificationCategory(
                identifier: failureCategory,
                actions: [UNNotificationAction(identifier: retryAction, title: "Retry", options: [])],
                intentIdentifiers: []
            )
        ])

        let arguments = Array(CommandLine.arguments.dropFirst())
        guard arguments.first == "notify" else {
            scheduleExit()
            return
        }
        let title = value(after: "--title", in: arguments) ?? "Contribution Calendar Mirror"
        let body = value(after: "--body", in: arguments) ?? "Sync needs attention."
        let retryCommand = value(after: "--retry-command", in: arguments)

        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            guard granted, error == nil else { DispatchQueue.main.async { NSApp.terminate(nil) }; return }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            if let retryCommand {
                content.categoryIdentifier = failureCategory
                content.userInfo = ["retryCommand": retryCommand]
            }
            self.center.add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)) { _ in
                self.scheduleExit()
            }
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        defer { completionHandler() }
        guard response.actionIdentifier == retryAction,
              let command = response.notification.request.content.userInfo["retryCommand"] as? String else { return }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: command)
        process.arguments = ["run"]
        try? process.run()
    }

    private func value(after flag: String, in arguments: [String]) -> String? {
        guard let index = arguments.firstIndex(of: flag), arguments.indices.contains(index + 1) else { return nil }
        return arguments[index + 1]
    }

    private func scheduleExit() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { NSApp.terminate(nil) }
    }
}
