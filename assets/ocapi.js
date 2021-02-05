class OCAPISettings {
    $cache = {}
    ocapiSettings = {}
    wildcardObject = {
        methods: ['get', 'post', 'put', 'patch', 'delete'],
        read_attributes: '(**)',
        write_attributes: '',
        resource_id: '/**'
    }
    LOCAL_STORAGE_HOST_KEY = 'ocapi_settings_host'

    constructor() {
        this.initialize()
    }

    client() {
        return {
            client_id: '<YOUR-CLIENT-ID-HERE>',
            allowed_origins: [],
            resources: []
        }
    }

    initialize() {
        this.initializeCache()
        this.initializeEvents()
    }

    initializeCache() {
        this.$cache = {
            document: $(document)
        }
        this.$cache.apiContent = this.$cache.document.find('.api-content')
        this.$cache.apiTree = this.$cache.apiContent.find('#paths-tree')
        this.$cache.ocapiSettingsTextarea = this.$cache.document.find('#ocapi-settings-generated')
        this.$cache.copyToClipboardBtn = this.$cache.document.find('.copy-to-clipboard')
        this.$cache.spinnerApiForm = this.$cache.document.find('.spinner-api-form')
        this.$cache.filterInput = this.$cache.apiContent.find('.tree-filter')
        this.$cache.allToggleTree = this.$cache.apiContent.find('.all-toggle-tree')
        this.$cache.wildcardToggleTree = this.$cache.apiContent.find('.wildcard-toggle-tree')
        this.$cache.apiForm = {
            host: this.$cache.document.find('#host'),
            client_id: this.$cache.document.find('#client_id'),
            client_secret: this.$cache.document.find('#client_secret'),
            host: this.$cache.document.find('#host'),
            api: this.$cache.document.find('.slds-radio_button-group.api-selector'),
            apiVersion: this.$cache.document.find('#api-version'),
            button: this.$cache.document.find('button.submit-api-form')
        }

        this.toggleErrorInForm(this.$cache.apiForm.api, false)
        this.$cache.spinnerApiForm.hide()
        this.$cache.apiContent.hide()
        this.$cache.apiForm.host.val(localStorage.getItem(this.LOCAL_STORAGE_HOST_KEY) || 'demo-ocapi.demandware.net')
    }

    initializeEvents() {
        // API form
        this.$cache.apiForm.button.on('click', e => {
            this.toggleErrorInForm(this.$cache.apiForm.api, false)
            const host = this.$cache.apiForm.host.val()
            const client_id = this.$cache.apiForm.client_id.val()
            const client_secret = this.$cache.apiForm.client_secret.val()
            const api = this.$cache.apiForm.api.find('input[type="radio"]:checked').val()
            const apiVersion = this.$cache.apiForm.apiVersion.val()

            if (!api) {
                this.toggleErrorInForm(this.$cache.apiForm.api, true)
                return
            }

            // Register GA event, don't send specific instance details, only the API details for metrics purpose
            this.registerEvent('search', {
                api,
                apiVersion
            })

            this.$cache.apiForm.button.attr('disabled', true)
            this.$cache.spinnerApiForm.show()

            this.fetchEndpoints(host, client_id, client_secret, api, apiVersion)
                .then(response => {
                    // Put the version of the API
                    this.ocapiSettings = {
                        _v: response.info.version,
                        clients: []
                    }

                    // Save host for future use in the local storage
                    localStorage.setItem(this.LOCAL_STORAGE_HOST_KEY, host)

                    return response.paths
                })
                .then(paths => this.constructPathsHTML(paths))
                .then(pathHTML => this.renderHTML(pathHTML))
                .then(() => {
                    // Once the paths have been displayed, adjust the rendering
                    this.fillOcapiSettingsTextArea()
                    this.$cache.apiForm.button.attr('disabled', false)
                    this.$cache.apiContent.show()
                    this.$cache.spinnerApiForm.hide()
                    this.$cache.allToggleTree.removeClass('slds-is-pressed').prop('aria-pressed', false)
                    this.$cache.wildcardToggleTree.removeClass('slds-is-pressed').prop('aria-pressed', false)
                })
                .catch(e => {
                    alert(e)
                    this.clearOcapiSettingsTextArea()
                    this.$cache.apiForm.button.attr('disabled', false)
                    this.$cache.allToggleTree.removeClass('slds-is-pressed').prop('aria-pressed', false)
                    this.$cache.wildcardToggleTree.removeClass('slds-is-pressed').prop('aria-pressed', false)
                    this.$cache.spinnerApiForm.hide()
                    this.$cache.apiContent.hide()
                })
        })

        this.$cache.apiTree.on('click', '[role="treeitem"]', e => {
            const $target = $(e.target)
            const $parent = $target.attr('role') === 'treeitem' ? $target : $target.parents('[role="treeitem"]')
            $parent.attr('aria-expanded', $parent.attr('aria-expanded') === 'false')
        })

        this.$cache.copyToClipboardBtn.on('click', e => {
            // Register GA event
            this.registerEvent('copy', {})
            navigator.clipboard.writeText(this.$cache.ocapiSettingsTextarea.val())
        })

        this.$cache.filterInput.on('blur', e => {
            this.filterTree($(e.target))
        })

        this.$cache.filterInput.on('keyup', e => {
            if (e.key === 'Enter') {
                this.filterTree($(e.target))
            }
        })

        this.$cache.allToggleTree.on('click', e => {
            let $target = $(e.target)
            if (!$target.hasClass('.slds-button')) {
                $target = $target.parents('.slds-button')
            }

            if ($target.hasClass('slds-is-pressed')) {
                // Toggle off all paths and methods
                this.$cache.apiTree.find('.slds-checkbox input[type="checkbox"]').prop('checked', false)
                // Register GA event
                this.registerEvent('alltoggle', {
                    enabled: false
                })
            } else {
                // Toggle on all paths and methods
                this.$cache.apiTree.find('[role="treeitem"]:visible .slds-checkbox input[type="checkbox"]').prop('checked', true)
                // Register GA event
                this.registerEvent('alltoggle', {
                    enabled: true
                })
            }

            this.handleCheckboxChange(this.$cache.apiTree)
            $target.toggleClass('slds-is-pressed')
            $target.prop('aria-pressed', $target.hasClass('slds-is-pressed'))
            this.$cache.wildcardToggleTree.removeClass('slds-is-pressed')
            this.$cache.wildcardToggleTree.prop('aria-pressed', false)
        })

        this.$cache.wildcardToggleTree.on('click', e => {
            let $target = $(e.target)
            if (!$target.hasClass('.slds-button')) {
                $target = $target.parents('.slds-button')
            }

            if ($target.hasClass('slds-is-pressed')) {
                // Toggle off all paths and methods
                this.ocapiSettings.clients = []
                this.fillOcapiSettingsTextArea()
                // Register GA event
                this.registerEvent('wildcardtoggle', {
                    enabled: false
                })
            } else {
                // Toggle on all paths and methods
                let clientObj = this.client();
                clientObj.resources.push(this.wildcardObject)
                this.upsertOcapiSettings(clientObj)
                this.fillOcapiSettingsTextArea()
                // Register GA event
                this.registerEvent('wildcardtoggle', {
                    enabled: true
                })
            }

            $target.toggleClass('slds-is-pressed')
            $target.prop('aria-pressed', $target.hasClass('slds-is-pressed'))
            this.$cache.allToggleTree.removeClass('slds-is-pressed')
            this.$cache.allToggleTree.prop('aria-pressed', false)
        })

        // Path selection
        this.$cache.apiTree.on('change', '[role="treeitem"][aria-level="1"] > .slds-tree__item .slds-checkbox input[type="checkbox"]', e => {
            const $target = $(e.target)
            // Update all the methods from the path when changed
            $target.parents('[role="treeitem"]').find('ul[role="group"] .slds-tree__item .slds-checkbox input[type="checkbox"]').prop('checked', $target.is(':checked'))
            this.handleCheckboxChange(this.$cache.apiTree)
        })

        // Method selection
        this.$cache.apiTree.on('change', '[role="treeitem"][aria-level="2"] > .slds-tree__item .slds-checkbox input[type="checkbox"]', e => {
            const $target = $(e.target)
            // Be sure to select the parent when we select at least one method
            $target.parents('[role="treeitem"][aria-level="1"]').find('> .slds-tree__item .slds-checkbox input[type="checkbox"]').prop('checked', true)
            this.handleCheckboxChange(this.$cache.apiTree)
        })
    }

    /**
     * Filters out the given tree
     *
     * @params {Object} $this
     **/
    filterTree($this) {
        var value = $this.val().toLowerCase();
        var treeSelector = '#' + $this.attr('aria-controls');

        // Register GA event
        this.registerEvent('filter', {
            value
        })

        this.removeMarkupFromTree(treeSelector);
        if (value.length > 1) {
            this.searchInTree(treeSelector, value);
        }
    }


    /**
     * Search the given value within the tree found from the given selector
     *
     * @params {String} selector
     * @params {String} value
     **/
    searchInTree(selector, value) {
        var $tree = $(selector);
        if ($tree.length === 0) {
            return;
        }

        $tree.find('[role="treeitem"][aria-level="1"] > .slds-tree__item .slds-tree__item-label .slds-tree__item-label__content').each((idx, label) => {
            var $this = $(label);
            var text = $this.text().toLowerCase();

            // If not found, then hide it
            if (text.indexOf(value) === -1) {
                $this.parents('[role="treeitem"][aria-level="1"]').addClass('slds-hide');
                return;
            }

            // If found, then
            // 1. keep it visible
            // 2. highlight the word
            // 3. expand the related parents
            var html = $this.html();
            var htmlWithMarks = html.replace(new RegExp('(' + value + ')', 'gi'), '<mark>$1</mark>');
            $this.html(htmlWithMarks);
        });
    }

    /**
     * Removes the markup from the tree found from the given selector
     *
     * @params {String} selector
     **/
    removeMarkupFromTree(selector) {
        var $tree = $(selector);
        if ($tree.length === 0) {
            return;
        }

        $tree.find('[role="treeitem"][aria-level="1"] > .slds-tree__item .slds-tree__item-label .slds-tree__item-label__content').each((idx, label) => {
            var $this = $(label);
            var html = $this.html();
            var htmlWithoutMarks = html.replace(/<\/?mark>/gm, '');
            $this.html(htmlWithoutMarks);

            // Set the item visible back
            $this.parents('[role="treeitem"][aria-level="1"]').removeClass('slds-hide');
        });
    }

    toggleErrorInForm($element, hasError) {
        if (hasError) {
            $element.parents('.slds-form-element').addClass('slds-has-error').find('.slds-form-element__help').show()
        } else {
            $element.parents('.slds-form-element').removeClass('slds-has-error').find('.slds-form-element__help').hide()
        }
        $element.attr('aria-invalid', hasError)
    }

    fetchEndpoints(host, clientId, clientSecret, api, apiVersion) {
        return new Promise((resolve, reject) => {
            this.performRequest('/apis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    host: host,
                    client_id: clientId,
                    client_secret: clientSecret,
                    api: api,
                    apiVersion: apiVersion
                })
            }).then(response => {
                if (!response.success) {
                    reject(response.error)
                    return;
                }

                const paths = response.paths;

                if (paths) {
                    resolve(response);
                } else {
                    reject('Cannot find paths')
                }
            }).catch(e => {
                reject(e)
            })
        })
    }

    renderHTML(html) {
        document.getElementById('paths-tree').innerHTML = html
    }

    constructPathsHTML(paths) {
        return Object.keys(paths).reduce((html, pathKey) => `${html}${this.constructPathHTML(pathKey, paths[pathKey])}`, '')
    }

    constructPathHTML(pathKey, path) {
        return `<li aria-expanded="false" aria-label="${pathKey}" aria-level="1" role="treeitem">
                    <div class="slds-tree__item">
                        <button class="slds-button slds-button_icon slds-m-right_x-small" aria-hidden="true" tabindex="-1" title="Expand ${pathKey}">
                            <svg class="slds-button__icon slds-button__icon_small" aria-hidden="true">
                                <use xlink:href="/assets/symbols.svg#chevronright"></use>
                            </svg>
                            <span class="slds-assistive-text">Expand ${pathKey}</span>
                        </button>
                        <span class="slds-has-flexi-truncate">
                            <span class="slds-tree__item-label slds-truncate" title="${pathKey}">
                                <div class="slds-form-element">
                                    <div class="slds-form-element__control">
                                        <div class="slds-checkbox">
                                            <input type="checkbox" name="options" id="${this.sanitizeID(pathKey)}" value="${this.sanitizeID(pathKey)}" />
                                            <label class="slds-checkbox__label" for="${this.sanitizeID(pathKey)}">
                                                <span class="slds-checkbox_faux"></span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <span class="slds-tree__item-label__content">${pathKey}</span>
                            </span>
                        </span>
                    </div>
                    <ul role="group">
                        ${this.constructPathMethodsHTML(pathKey, path)}
                    </ul>
                </li>`
    }

    constructPathMethodsHTML(pathKey, path) {
        return Object.keys(path).reduce((html, methodKey) => `${html}${this.constructPathMethodHTML(pathKey, methodKey, path[methodKey])}`, '')
    }

    constructPathMethodHTML(pathKey, methodKey, methodObj) {
        return `<li aria-level="2" role="treeitem">
                    <div class="slds-tree__item">
                        <button class="slds-button slds-button_icon slds-m-right_x-small slds-is-disabled" aria-hidden="true" tabindex="-1" title="${methodKey}">
                            <svg class="slds-button__icon slds-button__icon_small" aria-hidden="true">
                                <use xlink:href="/assets/symbols.svg#chevronright"></use>
                            </svg>
                            <span class="slds-assistive-text">Expand ${methodKey}</span>
                        </button>
                        <span class="slds-has-flexi-truncate">
                            <span class="slds-tree__item-label slds-truncate" title="${methodKey}">
                                <div class="slds-form-element">
                                    <div class="slds-form-element__control">
                                        <div class="slds-checkbox">
                                            <input type="checkbox" name="options" id="${this.sanitizeID(pathKey)}|${methodKey}" value="${this.sanitizeID(pathKey)}|${methodKey}" />
                                            <label class="slds-checkbox__label" for="${this.sanitizeID(pathKey)}|${methodKey}">
                                                <span class="slds-checkbox_faux"></span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <span class="slds-tree__item-label__content">${methodKey}</span>
                            </span>
                            <span class="slds-tree__item-meta slds-truncate" title="${methodObj.description}">
                            <span class="slds-assistive-text">:</span>${methodObj.description}</span>
                        </span>
                    </div>
                </li>`
    }

    handleCheckboxChange($tree) {
        this.upsertOcapiSettings(this.buildClient($tree))
        this.fillOcapiSettingsTextArea()
    }

    buildClient($treeElement) {
        let clientObj = this.client();

        $treeElement.find('[role="treeitem"][aria-level="1"] > .slds-tree__item .slds-checkbox input[type="checkbox"]:checked').each((idx, pathCheckbox) => {
            const $pathCheckbox = $(pathCheckbox)
            const resource = {
                resource_id: this.sanitizeID($pathCheckbox.val(), '__', '/'),
                methods: []
            }

            $pathCheckbox.parents('[role="treeitem"]').find('[role="treeitem"][aria-level="2"] > .slds-tree__item .slds-checkbox input[type="checkbox"]:checked').each((idx, methodCheckbox) => {
                resource.methods.push($(methodCheckbox).val().split('|')[1])
            })

            clientObj.resources.push(resource)
        })

        return clientObj
    }

    upsertOcapiSettings(client) {
        const alreadyDefinedClientIndex = this.ocapiSettings.clients.findIndex(clientObj => clientObj.client_id === client.client_id)
        if (alreadyDefinedClientIndex > -1) {
            this.ocapiSettings.clients.splice(alreadyDefinedClientIndex, 1, this.constructOcapiClient(client))
        } else {
            this.ocapiSettings.clients.push(this.constructOcapiClient(client))
        }
    }

    constructOcapiClient(client) {
        return {
            client_id: client.client_id,
            resources: client.resources.map(resource => this.constructOcapiResource(resource))
        }
    }

    constructOcapiResource(resource) {
        return {
            resource_id: resource.resource_id,
            methods: resource.methods,
            read_attributes: resource.read_attributes || '(**)',
            write_attributes: resource.write_attributes || '(**)'
        }
    }

    fillOcapiSettingsTextArea() {
        this.$cache.ocapiSettingsTextarea.val(JSON.stringify(this.ocapiSettings, undefined, '\t'))
    }

    clearOcapiSettingsTextArea() {
        this.$cache.ocapiSettingsTextarea.val('')
    }

    sanitizeID(str, delimiter = '/', replacer = '__') {
        return str.split(delimiter).join(replacer)
    }

    async performRequest(url, options) {
        return await fetch(url, options).then(response => response.json());
    }

    registerEvent(eventName, eventData) {
        if (typeof gtag === 'undefined') {
            return;
        }

        gtag(eventName, eventData);
    }
}

window.OCAPISettings = new OCAPISettings()
