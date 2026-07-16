// Conversión de Buffer/ArrayBuffer a Base64 y viceversa
const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// 1. Obtener o Generar Llaves de Usuario
export const obtenerOGenerarLlavesE2E = async () => {
    let privateKeyJWK = localStorage.getItem('e2e_private_key');
    let publicKeyJWK = localStorage.getItem('e2e_public_key');

    if (!privateKeyJWK || !publicKeyJWK) {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true,
            ['encrypt', 'decrypt']
        );

        const exportedPublic = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const exportedPrivate = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

        publicKeyJWK = JSON.stringify(exportedPublic);
        privateKeyJWK = JSON.stringify(exportedPrivate);

        localStorage.setItem('e2e_public_key', publicKeyJWK);
        localStorage.setItem('e2e_private_key', privateKeyJWK);
    }

    return { publicKeyJWK, privateKeyJWK };
};

// 2. Cifrar Mensaje (E2E)
export const encriptarMensaje = async (texto, publicKeyReceptorJWK, publicKeyCreadorJWK) => {
    // Generar clave simétrica AES-GCM para este mensaje puntual
    const aesKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    // Cifrar el texto plano con AES-GCM
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const contenidoCifradoBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encoder.encode(texto)
    );

    // Importar llaves públicas de creador y receptor
    const keyReceptor = await window.crypto.subtle.importKey(
        'jwk',
        JSON.parse(publicKeyReceptorJWK),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
    );

    const keyCreador = await window.crypto.subtle.importKey(
        'jwk',
        JSON.parse(publicKeyCreadorJWK),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
    );

    // Exportar la clave AES para cifrarla individualmente con la RSA Public Key de cada usuario
    const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

    const claveCifradaReceptorBuffer = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        keyReceptor,
        rawAesKey
    );

    const claveCifradaCreadorBuffer = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        keyCreador,
        rawAesKey
    );

    return {
        contenidoCifrado: arrayBufferToBase64(contenidoCifradoBuffer),
        iv: arrayBufferToBase64(iv),
        claveCifradaReceptor: arrayBufferToBase64(claveCifradaReceptorBuffer),
        claveCifradaCreador: arrayBufferToBase64(claveCifradaCreadorBuffer)
    };
};

// 3. Descifrar Mensaje (E2E)
export const desencriptarMensaje = async (msgObj, esCreador = false) => {
    try {
        const privateKeyJWK = localStorage.getItem('e2e_private_key');
        if (!privateKeyJWK) return '[Llave privada no encontrada]';

        const privateKey = await window.crypto.subtle.importKey(
            'jwk',
            JSON.parse(privateKeyJWK),
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['decrypt']
        );

        const claveCifradaTarget = esCreador ? msgObj.claveCifradaCreador : msgObj.claveCifradaReceptor;
        const rawAesKey = await window.crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            privateKey,
            base64ToArrayBuffer(claveCifradaTarget)
        );

        const aesKey = await window.crypto.subtle.importKey(
            'raw',
            rawAesKey,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        const textoBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: base64ToArrayBuffer(msgObj.iv) },
            aesKey,
            base64ToArrayBuffer(msgObj.contenidoCifrado)
        );

        return new TextDecoder().decode(textoBuffer);
    } catch (error) {
        console.error('Error descifrando mensaje:', error);
        return '[Mensaje no descifrable]';
    }
};