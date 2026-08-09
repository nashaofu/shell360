import Foundation

struct BridgeRequest: Decodable {
    let id: String
    let clientId: String
    let method: String
    let params: AnyCodable?

    enum CodingKeys: String, CodingKey {
        case id
        case clientId
        case method
        case params
    }
}

struct BridgeResponse: Encodable {
    let id: String?
    let result: AnyCodable?
    let error: BridgeErrorPayload?
    let clientId: String?
    let event: String?
    let targetId: String?
    let sequence: UInt64?
    let payload: AnyCodable?

    nonisolated static func success(id: String, result: AnyCodable? = nil) -> BridgeResponse {
        BridgeResponse(
            id: id,
            result: result,
            error: nil,
            clientId: nil,
            event: nil,
            targetId: nil,
            sequence: nil,
            payload: nil
        )
    }

    nonisolated static func failure(id: String?, error: BridgeErrorPayload) -> BridgeResponse {
        BridgeResponse(
            id: id,
            result: nil,
            error: error,
            clientId: nil,
            event: nil,
            targetId: nil,
            sequence: nil,
            payload: nil
        )
    }
}

struct BridgeErrorPayload: Encodable {
    let code: String
    let message: String
    let details: AnyCodable?
}

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            value = NSNull()
        } else if let value = try? container.decode(Bool.self) {
            self.value = value
        } else if let value = try? container.decode(Int.self) {
            self.value = value
        } else if let value = try? container.decode(Double.self) {
            self.value = value
        } else if let value = try? container.decode(String.self) {
            self.value = value
        } else if let value = try? container.decode([AnyCodable].self) {
            self.value = value.map(\.value)
        } else if let value = try? container.decode([String: AnyCodable].self) {
            self.value = value.mapValues(\.value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let value as Bool:
            try container.encode(value)
        case let value as Int:
            try container.encode(value)
        case let value as Double:
            try container.encode(value)
        case let value as String:
            try container.encode(value)
        case let value as [Any]:
            try container.encode(value.map(AnyCodable.init))
        case let value as [String: Any]:
            try container.encode(value.mapValues(AnyCodable.init))
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: container.codingPath, debugDescription: "Unsupported JSON value"))
        }
    }
}
