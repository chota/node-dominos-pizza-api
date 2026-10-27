import AppKit
import CoreLocation

func emit(_ value: [String: Any], code: Int32 = 0) {
    if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) {
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data([10]))
    }
    exit(code)
}

final class LocationHelper: NSObject, NSApplicationDelegate, CLLocationManagerDelegate {
    let manager = CLLocationManager()
    let geocoder = CLGeocoder()
    var requested = false
    var resolving = false
    var timeout: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        if CommandLine.arguments.contains("--status") {
            emit(["authorization": manager.authorizationStatus.rawValue])
        }
        timeout = Timer.scheduledTimer(withTimeInterval: 40, repeats: false) { _ in
            emit(["error": "Location timed out. You can enter your address or retry with Control+L."], code: 1)
        }
        authorize()
    }
    func authorize() {
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            if !requested { requested = true; manager.requestLocation() }
        case .denied, .restricted:
            emit(["error": "Location access is unavailable. Enable domexplore Location in System Settings, or enter your address."], code: 1)
        @unknown default: emit(["error": "Unknown location authorization status."], code: 1)
        }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { authorize() }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard !resolving, let location = locations.last, location.horizontalAccuracy >= 0 else { return }
        resolving = true
        manager.stopUpdatingLocation()
        geocoder.reverseGeocodeLocation(location) { places, error in
            if let error = error { emit(["error": error.localizedDescription], code: 1) }
            guard let place = places?.first else { emit(["error": "No address was found. Enter your address manually."], code: 1); return }
            let street = [place.subThoroughfare, place.thoroughfare].compactMap { $0 }.joined(separator: " ")
            let address = ["street": street, "city": place.locality ?? place.subAdministrativeArea ?? "", "region": place.administrativeArea ?? "", "postalCode": place.postalCode ?? ""]
            emit(["address": address, "accuracyMeters": location.horizontalAccuracy])
        }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        emit(["error": error.localizedDescription], code: 1)
    }
}
let app = NSApplication.shared
let helper = LocationHelper()
app.setActivationPolicy(.accessory)
app.delegate = helper
app.run()
