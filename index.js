const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const request = require('request-promise-native')

const app = express()
const port = process.env.PORT || 3000
const authURL = 'https://account.demandware.com/dw/oauth2/access_token'
const baseURL = (host) => `https://${host}/s/-/dw/meta/v1/rest`
const defaultClientID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const defaultClientSecret = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
var authToken = undefined
const defaultRequestOptions = url => {
    return {
        url: url,
        method: 'GET',
        headers: {
            'Authorization': authToken
        },
        json: true
    }
}

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use('/assets', express.static('assets'))
app.use(bodyParser.json());

app.get('/', (req, res) => res.render('index', {
    googleAnalyticsTagID: process.env.GA_TAG_ID
}))

app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, '/src/manifest.json')))
app.get('/service-worker.js', (req, res) => res.sendFile(path.join(__dirname, '/src/service-worker.js')))

app.post('/apis', (req, res) => {
    fetchEndpoints(
        req.body.host,
        req.body.client_id,
        req.body.client_secret,
        req.body.api,
        req.body.apiVersion
    ).then(paths => res.send(JSON.stringify(paths))).catch(e => {
        res.send(JSON.stringify({
            success: false,
            error: JSON.stringify(e)
        }))
    })
})

app.listen(port, () => console.log(`App started & now listening`))

function fetchEndpoints(host, clientId, clientSecret, apiName, apiVersion) {
    const client_id = clientId || defaultClientID
    const client_secret = clientSecret || defaultClientSecret

    return new Promise((resolve, reject) => {
        var promise = Promise.resolve()
        promise = promise.then(() => authenticate(client_id, client_secret))
        promise = promise.then(() => getAPI(host, apiName))
        promise = promise.then(apiURL => getVersion(apiURL, apiVersion))
        promise = promise.then(apiURL => getPaths(apiURL))
        promise = promise.then(response => {
            if (!response.paths) {
                reject(`Failed to find paths in the ${apiName} API. Please ensure you allowed at least one endpoint for the ${client_id} client ID on the ${host} instance.`)
                return
            }

            transformedPaths = {}
            Object.keys(response.paths).forEach(pathKey => {
                newPathKey = pathKey.replace(/{\S+}/gi, '*')
                transformedPaths[newPathKey] = response.paths[pathKey]
            })

            response.success = true
            response.paths = transformedPaths
            resolve(response)
        })

        promise = promise.catch(err => {
            console.log(err);
            reject(err);
        });
    })
}

function authenticate(clientID, clientSecret) {
    return new Promise((resolve, reject) => {
        performRequest({
            url: authURL,
            method: 'POST',
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(clientID + ':' + clientSecret).toString('base64')}`
            },
            body: 'grant_type=client_credentials',
            json: true
        }).then(response => {
            if (response.access_token) {
                authToken = `${response.token_type} ${response.access_token}`
                resolve(authToken)
                return
            }

            reject(`Cannot authenticate with the ${defaultClientID} client ID and ${defaultClientSecret} client secret.`)
        }).catch(e => reject(e))
    })
}

function getAPI(host, apiName) {
    return new Promise((resolve, reject) => {
        performRequest(defaultRequestOptions(baseURL(host))).then(response => {
            const api = response.apis.find(api => api.name === apiName)

            if (api) {
                resolve(api.link)
                return
            }

            reject(`Cannot find the api ${apiName} on the ${host} instance. Please ensure you authorized it in the OCAPI Settings.`)
        }).catch(e => reject(e))
    })
}

function getVersion(apiURL, apiVersion) {
    return new Promise((resolve, reject) => {
        performRequest(defaultRequestOptions(apiURL)).then(response => {
            const version = apiVersion
                ? response.versions.find(version => version.name === apiVersion || version.status === apiVersion)
                : response.versions.find(version => version.status === 'current')

            if (version) {
                resolve(version.link)
                return
            }

            reject(`Cannot find the version ${apiVersion} in the API ${apiURL}.`)
        }).catch(e => reject(e))
    })
}

function getPaths(apiURL) {
    return performRequest(defaultRequestOptions(apiURL))
}

function performRequest(options) {
    return request(options)
}