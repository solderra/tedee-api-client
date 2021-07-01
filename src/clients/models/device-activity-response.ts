export interface DeviceActivity {
    id: number
    deviceId: number
    userId: number
    username: string
    event: number
    source: number
    date: string
}


/**
 * Represents the HTTP API model for a response with device activity.
 */
 export interface DeviceActivityResponse {
     success: boolean

     errorMessages: [string]

     statusCode: number

    /**
     * Gets or sets the requested sync information for a single lock.
     */
    result: [DeviceActivity]
}
