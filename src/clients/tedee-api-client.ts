
import axios from 'axios'
import qs from 'qs'

import { TokenResponse } from './models/token-response'
import { Lock } from './models/lock'
import { LocksResponse } from './models/locks-response'
import { LockSync } from './models/lock-sync'
import { LocksSyncResponse } from './models/locks-sync-response'
import { LockSyncResponse } from './models/lock-sync-response'
import { OperationResponse } from './models/operation-response'
import { OperationStatus } from './models/operation-status'
import { DeviceActivity, DeviceActivityResponse } from './models/device-activity-response'
import { createLogger, Logger, transports } from 'winston'
import { Configuration } from '../configuration/configuration'

const TOKEN_URL = 'https://tedee.b2clogin.com/tedee.onmicrosoft.com/oauth2/v2.0/token?p=B2C_1_SignIn_Ropc'
const API_BASE_URL = 'https://api.tedee.com/api/v1.18'

/**
 * Represents a client that communicates with the Tedee HTTP API.
 */
export class TedeeApiClient {

    /**
     * Initializes a new TedeeApiClient instance.
     * @param configuration The client configuration.
     */
    constructor(private configuration: Configuration, logger?: Logger) {
        this.logger = logger || createLogger({level: 'warn', transports: [new transports.Console()]})
    }

    /**
     * Contains the expiration date time for the access token.
     */
    private expirationDateTime: Date|null = null

    /**
     * Contains the currently active access token.
     */
    private accessToken: string|null = null

    private logger: Logger

    /**
     * Gets the access token either from cache or from the token endpoint.
     * @param retryCount The number of retries before reporting failure.
     */
    private async getAccessTokenAsync(retryCount?: number): Promise<string> {
        this.logger.debug(`Getting access token...`)

        // Checks if the current access token is expired
        if (this.expirationDateTime && this.expirationDateTime.getTime() < new Date().getTime() - (120 * 1000)) {
            this.expirationDateTime = null
            this.accessToken = null
        }

        // Checks if a cached access token exists
        if (this.accessToken) {
            this.logger.debug(`Access token cached.`)
            return this.accessToken
        }

        // Set the default retry count
        if (!retryCount) {
            retryCount = this.configuration.maximumTokenRetry
        }

        // Sends the HTTP request to get a new access token
        try {
            const response = await axios.post<TokenResponse>(TOKEN_URL, qs.stringify({
                grant_type: 'password',
                username:  this.configuration.emailAddress,
                password: this.configuration.password,
                scope: 'openid 02106b82-0524-4fd3-ac57-af774f340979',
                client_id: '02106b82-0524-4fd3-ac57-af774f340979',
                response_type: 'token id_token'
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })

            // Stores the access token
            this.accessToken = response.data.access_token
            this.expirationDateTime = new Date(new Date().getTime() + (response.data.expires_in * 1000))

            // Returns the access token
            this.logger.debug(`Access token received from server.`)
            return this.accessToken
        } catch (e) {
            this.logger.warn(`Error while retrieving access token: ${e}`)

            // Decreased the retry count and tries again
            retryCount--
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.configuration.tokenRetryInterval))
                return await this.getAccessTokenAsync(retryCount)
            } else {
                throw e
            }
        }
    }

    /**
     * Gets all locks from the API.
     * @param retryCount The number of retries before reporting failure.
     */
    public async getLocksAsync(retryCount?: number): Promise<Array<Lock>> {
        this.logger.debug(`Getting locks from API...`)

        // Set the default retry count
        if (!retryCount) {
            retryCount = this.configuration.maximumApiRetry
        }

        // Gets the access token
        const accessToken = await this.getAccessTokenAsync()

        // Sends the HTTP request to get the locks
        try {
            const response = await axios.get<LocksResponse>(`${API_BASE_URL}/my/lock`, { 
                headers: {
                    Authorization: `Bearer ${accessToken}`
                } 
            })
            this.logger.debug(JSON.stringify(response.data))
            this.logger.debug(`Locks received from API.`)
            return response.data.result
        } catch (e) {
            this.logger.warn(`Error while getting locks from API: ${e}`)

            // Decreased the retry count and tries again
            retryCount--
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.configuration.apiRetryInterval))
                return await this.getLocksAsync(retryCount)
            } else {
                throw e
            }
        }
    }

    public async getLockByNameAsync(name: string, retryCount?: number): Promise<Lock|undefined> {
        return (await this.getLocksAsync(retryCount)).find(l => l.name === name)
    }

    /**
     * Syncs the recent changes of all locks from the API.
     * @param retryCount The number of retries before reporting failure.
     */
    public async syncLocksAsync(retryCount?: number): Promise<Array<LockSync>> {
        this.logger.debug(`Syncing locks from API...`)

        // Set the default retry count
        if (!retryCount) {
            retryCount = this.configuration.maximumApiRetry
        }

        // Gets the access token
        const accessToken = await this.getAccessTokenAsync()

        // Sends the HTTP request to sync the locks
        try {
            const response = await axios.get<LocksSyncResponse>(`${API_BASE_URL}/my/lock/sync`, { 
                headers: {
                    Authorization: `Bearer ${accessToken}`
                } 
            })
            this.logger.debug(JSON.stringify(response.data))
            this.logger.debug(`Locks synced from API.`)
            return response.data.result
        } catch (e) {
            this.logger.warn(`Error while syncing locks from API: ${e}`)

            // Decreased the retry count and tries again
            retryCount--
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.configuration.apiRetryInterval))
                return await this.syncLocksAsync(retryCount)
            } else {
                throw e
            }
        }
    }

    /**
     * Syncs the recent changes of a single lock from the API.
     * @param id The ID of the lock.
     * @param retryCount The number of retries before reporting failure.
     */
    public async syncLockAsync(id: number, retryCount?: number): Promise<LockSync> {
        this.logger.debug(`Syncing lock with ID ${id} from API...`)

        // Set the default retry count
        if (!retryCount) {
            retryCount = this.configuration.maximumApiRetry
        }

        // Gets the access token
        const accessToken = await this.getAccessTokenAsync()

        // Sends the HTTP request to sync the locks
        try {
            const response = await axios.get<LockSyncResponse>(`${API_BASE_URL}/my/lock/${id}/sync`, { 
                headers: {
                    Authorization: `Bearer ${accessToken}`
                } 
            })
            this.logger.debug(JSON.stringify(response.data))
            this.logger.debug(`Lock with ID ${id} synced from API.`)
            return response.data.result
        } catch (e) {
            this.logger.warn(`Error while syncing lock with ID ${id} from API: ${e}`)

            // Decreased the retry count and tries again
            retryCount--
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.configuration.apiRetryInterval))
                return await this.syncLockAsync(id, retryCount)
            } else {
                throw e
            }
        }
    }

    /**
     * Closes the lock with the specified ID.
     * @param lock The lock which should be closed.
     * @param retryCount The number of retries before reporting failure.
     */
    public async closeAsync(lock: Lock, retryCount?: number): Promise<void> {

        this.logger.debug(`[${lock.name}] Closing via API...`)

        // Set the default retry count
        if (!retryCount) {
            retryCount = this.configuration.maximumApiRetry
        }

        // Gets the access token
        const accessToken = await this.getAccessTokenAsync()

        // Sends the HTTP request to set the box status
        try {
            let response = await axios.post<OperationResponse>(`${API_BASE_URL}/my/lock/close`, { deviceId: lock.id }, { 
                headers: {
                    Authorization: `Bearer ${accessToken}`
                } 
            })
            this.logger.debug(JSON.stringify(response.data))

            // Waits for the operation to complete
            while (response.data.result.status !== OperationStatus.Completed) {
                await new Promise<void>(r => setTimeout(() => r(), 1000))

                response = await axios.get<OperationResponse>(`${API_BASE_URL}/my/device/operation/${response.data.result.operationId}`, { 
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    } 
                })

                this.logger.debug(JSON.stringify(response.data))
                this.logger.info(`[${lock.name}] Waiting for close operation to be completed.`)
            }

            this.logger.info(`[${lock.name}] Closed via API.`)
        } catch (e) {
            this.logger.warn(`[${lock.name}] Error while closing via API: ${e}`)

            // Decreased the retry count and tries again
            retryCount--
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.configuration.apiRetryInterval))
                await this.closeAsync(lock, retryCount)
            } else {
                throw e
            }
        }
    }

    /**
     * Opens the lock with the specified ID.
     * @param id The ID of the lock.
     * @param retryCount The number of retries before reporting failure.
     */
    public async openAsync(lock: Lock, retryCount?: number): Promise<void> {

        this.logger.debug(`[${lock.name}] Opening via API...`)

        // Set the default retry count
        if (!retryCount) {
            retryCount = this.configuration.maximumApiRetry
        }

        // Gets the access token
        const accessToken = await this.getAccessTokenAsync()

        // Sends the HTTP request to set the box status
        try {
            let response = await axios.post<OperationResponse>(`${API_BASE_URL}/my/lock/open`, { deviceId: lock.id }, { 
                headers: {
                    Authorization: `Bearer ${accessToken}`
                } 
            })
            this.logger.debug(JSON.stringify(response.data))

            // Waits for the operation to complete
            while (response.data.result.status !== OperationStatus.Completed) {
                await new Promise<void>(r => setTimeout(() => r(), 1000))

                response = await axios.get<OperationResponse>(`${API_BASE_URL}/my/device/operation/${response.data.result.operationId}`, { 
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    } 
                })

                this.logger.debug(JSON.stringify(response.data))
                this.logger.info(`[${lock.name}] Waiting for open operation to be completed.`)
            }

            this.logger.info(`[${lock.name}] Opened via API.`)
        } catch (e) {
            this.logger.warn(`[${lock.name}] Error while opening via API: ${e}`)

            // Decreased the retry count and tries again
            retryCount--
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.configuration.apiRetryInterval))
                await this.openAsync(lock, retryCount)
            } else {
                throw e
            }
        }
    }

    /**
     * Pulls the spring on the lock with the specified ID.
     * @param id The ID of the lock.
     * @param retryCount The number of retries before reporting failure.
     */
    public async pullSpringAsync(lock: Lock, retryCount?: number): Promise<void> {

        this.logger.debug(`[${lock.name}] Pulling spring via API...`)

        // Set the default retry count
        if (!retryCount) {
            retryCount = this.configuration.maximumApiRetry
        }

        // Gets the access token
        const accessToken = await this.getAccessTokenAsync()

        // Sends the HTTP request to set the box status
        try {
            let response = await axios.post<OperationResponse>(`${API_BASE_URL}/my/lock/pull-spring`, { deviceId: lock.id }, { 
                headers: {
                    Authorization: `Bearer ${accessToken}`
                } 
            })
            this.logger.debug(JSON.stringify(response.data))

            // Waits for the operation to complete
            while (response.data.result.status !== OperationStatus.Completed) {
                await new Promise<void>(r => setTimeout(() => r(), 1000))

                response = await axios.get<OperationResponse>(`${API_BASE_URL}/my/device/operation/${response.data.result.operationId}`, { 
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    } 
                })

                this.logger.debug(JSON.stringify(response.data))
                this.logger.info(`[${lock.name}] Waiting for pull spring operation to be completed.`)
            }

            this.logger.info(`[${lock.name}] Pulled spring via API.`)
        } catch (e) {
            this.logger.warn(`[${lock.name}] Error while pulling spring via API: ${e}`)

            // Decreased the retry count and tries again
            retryCount--
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.configuration.apiRetryInterval))
                await this.pullSpringAsync(lock, retryCount)
            } else {
                throw e
            }
        }
    }

    /**
     * 
     * @param id The ID of the lock.
     * @param retryCount The number of retries before reporting failure.
     */
    public async getDeviceActivityAsync(lock: Lock, count: number, retryCount?: number): Promise<Array<DeviceActivity>> {
        this.logger.debug(`[${lock.name}] Fetching device activity via API...`)

        // Set the default retry count
        if (!retryCount) {
            retryCount = this.configuration.maximumApiRetry
        }

        // Gets the access token
        const accessToken = await this.getAccessTokenAsync()

        // Sends the HTTP request to set the box status
        try {
            let response = await axios.get<DeviceActivityResponse>(`${API_BASE_URL}/my/deviceactivity?deviceId=${lock.id}&elements=${count}`, { 
                headers: {
                    Authorization: `Bearer ${accessToken}`
                } 
            })
            return response.data.result
        } catch (e) {
            this.logger.warn(`[${lock.name}] Error while fetching device activity via API: ${e}`)

            // Decreased the retry count and tries again
            retryCount--
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, this.configuration.apiRetryInterval))
                return await this.getDeviceActivityAsync(lock, retryCount)
            } else {
                throw e
            }
        }
    }

    /**
     * 
     * @param id The ID of the lock.
     * @param retryCount The number of retries before reporting failure.
     */
     public async getLatestDeviceActivityAsync(lock: Lock, retryCount?: number): Promise<DeviceActivity | null> {
        const activities = await this.getDeviceActivityAsync(lock, 1, retryCount)
        return activities[0] || null
    }
}
