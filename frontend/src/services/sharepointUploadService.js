import { PublicClientApplication } from '@azure/msal-browser';

const SHAREPOINT_CONFIG = {
    clientId: 'REPLACE_WITH_AZURE_APP_CLIENT_ID',
    tenantId: 'REPLACE_WITH_AZURE_TENANT_ID',
    siteId: 'REPLACE_WITH_SHAREPOINT_SITE_ID',
    driveId: 'REPLACE_WITH_SHAREPOINT_DRIVE_ID',
    folderPath: 'ProductImages'
};

const GRAPH_SCOPES = ['Sites.ReadWrite.All', 'Files.ReadWrite.All'];

const msalApp = new PublicClientApplication({
    auth: {
        clientId: SHAREPOINT_CONFIG.clientId,
        authority: `https://login.microsoftonline.com/${SHAREPOINT_CONFIG.tenantId}`,
        redirectUri: window.location.origin
    },
    cache: {
        cacheLocation: 'localStorage'
    }
});

function validateConfig() {
    const missing = Object.entries(SHAREPOINT_CONFIG)
        .filter(([, value]) => String(value).startsWith('REPLACE_WITH_'))
        .map(([key]) => key);

    if (missing.length > 0) {
        throw new Error(`SharePoint config missing: ${missing.join(', ')}`);
    }
}

async function getAccessToken() {
    await msalApp.initialize();
    const accounts = msalApp.getAllAccounts();
    const account = accounts[0];

    if (!account) {
        const loginResponse = await msalApp.loginPopup({ scopes: GRAPH_SCOPES });
        const tokenResponse = await msalApp.acquireTokenSilent({
            account: loginResponse.account,
            scopes: GRAPH_SCOPES
        });
        return tokenResponse.accessToken;
    }

    const tokenResponse = await msalApp.acquireTokenSilent({
        account,
        scopes: GRAPH_SCOPES
    });
    return tokenResponse.accessToken;
}

export async function uploadImageToSharePoint(file) {
    if (!file) throw new Error('No file provided');
    validateConfig();

    const accessToken = await getAccessToken();
    const safeName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_CONFIG.siteId}/drives/${SHAREPOINT_CONFIG.driveId}/root:/${SHAREPOINT_CONFIG.folderPath}/${safeName}:/content`;

    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
    });

    if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        throw new Error(`SharePoint upload failed: ${uploadResponse.status} ${text}`);
    }

    const uploaded = await uploadResponse.json();
    return {
        fileId: uploaded.id,
        webUrl: uploaded.webUrl || '',
        directUrl: uploaded['@microsoft.graph.downloadUrl'] || ''
    };
}

