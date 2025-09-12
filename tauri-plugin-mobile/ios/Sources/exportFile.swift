import Foundation
import UIKit

func exportFile(view: UIView, filename: String, data: Data) async throws -> Bool {
  return try await withCheckedThrowingContinuation { continuation in
    // Get the temporary directory
    let temporaryDirectory = URL(fileURLWithPath: NSTemporaryDirectory())

    // Create a file URL for the document
    let fileURL = temporaryDirectory.appendingPathComponent(filename)
    do {
      // Write to the file
      try data.write(to: fileURL, options: .atomic)
      DispatchQueue.main.async {
        let activityViewController = UIActivityViewController(
          activityItems: [fileURL],
          applicationActivities: nil
        )

        if let popoverController = activityViewController.popoverPresentationController {
          popoverController.sourceView = view
          // Position the popover at bottom center
          popoverController.sourceRect = CGRect(
            x: view.bounds.midX,
            y: view.bounds.maxY,
            width: 0,
            height: 0
          )
          popoverController.permittedArrowDirections = []  // Remove arrow
        }

        activityViewController.completionWithItemsHandler = {
          activityType, completed, returnedItems, error in
          if error != nil {
            continuation.resume(throwing: error!)
            return
          }

          continuation.resume(returning: completed)
        }

        UIApplication.shared.windows.first?.rootViewController?.present(
          activityViewController,
          animated: true,
          completion: nil
        )
      }
    } catch {
      continuation.resume(throwing: error)
    }
  }
}
