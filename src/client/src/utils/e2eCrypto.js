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

const normalizarBaseUrlApi = (apiBaseUrl = '') => {
    return String(apiBaseUrl || '').replace(/\/+$/, '');
};

const obtenerIdUsuarioActual = () => {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        return usuario.id || usuario._id || null;
    } catch (error) {
        return null;
    }
};

const claveStorageE2E = (nombre, userId = null) => {
    const id = userId || obtenerIdUsuarioActual();
    return id ? `${nombre}_${id}` : nombre;
};

const obtenerPublicKeyDesdePrivateKey = (privateKeyJWK) => {
    const privateKey = typeof privateKeyJWK === 'string'
        ? JSON.parse(privateKeyJWK)
        : privateKeyJWK;

    return JSON.stringify({
        kty: privateKey.kty,
        n: privateKey.n,
        e: privateKey.e,
        alg: privateKey.alg || 'RSA-OAEP-256',
        ext: privateKey.ext !== false,
        key_ops: ['encrypt']
    });
};

const clavesCoinciden = (publicKeyJWK, privateKeyJWK) => {
    try {
        const publicKey = typeof publicKeyJWK === 'string'
            ? JSON.parse(publicKeyJWK)
            : publicKeyJWK;

        const privateKey = typeof privateKeyJWK === 'string'
            ? JSON.parse(privateKeyJWK)
            : privateKeyJWK;

        return Boolean(
            publicKey?.kty &&
            privateKey?.kty &&
            publicKey.kty === privateKey.kty &&
            publicKey.n === privateKey.n &&
            publicKey.e === privateKey.e
        );
    } catch (error) {
        return false;
    }
};

const importarLlaveDerivadaDesdePassword = async (password, saltBase64) => {
    if (!password) {
        throw new Error('Se requiere la contraseña para sincronizar el cifrado entre dispositivos.');
    }

    const encoder = new TextEncoder();
    const materialBase = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: base64ToArrayBuffer(saltBase64),
            iterations: 210000,
            hash: 'SHA-256'
        },
        materialBase,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

const cifrarPrivateKeyConPassword = async (privateKeyJWK, password) => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const saltBase64 = arrayBufferToBase64(salt);
    const ivBase64 = arrayBufferToBase64(iv);
    const llavePassword = await importarLlaveDerivadaDesdePassword(password, saltBase64);

    const contenidoCifrado = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        llavePassword,
        new TextEncoder().encode(privateKeyJWK)
    );

    return {
        encryptedPrivateKey: arrayBufferToBase64(contenidoCifrado),
        e2eSalt: saltBase64,
        e2eIv: ivBase64
    };
};

const descifrarPrivateKeyConPassword = async ({ encryptedPrivateKey, e2eSalt, e2eIv, password }) => {
    const llavePassword = await importarLlaveDerivadaDesdePassword(password, e2eSalt);

    const privateKeyBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToArrayBuffer(e2eIv) },
        llavePassword,
        base64ToArrayBuffer(encryptedPrivateKey)
    );

    return new TextDecoder().decode(privateKeyBuffer);
};

const generarParDeLlavesE2E = async () => {
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

    return {
        publicKeyJWK: JSON.stringify(exportedPublic),
        privateKeyJWK: JSON.stringify(exportedPrivate)
    };
};

const guardarLlavesLocales = ({ publicKeyJWK, privateKeyJWK }, userId = null) => {
    if (publicKeyJWK) {
        localStorage.setItem(claveStorageE2E('e2e_public_key', userId), publicKeyJWK);
        localStorage.setItem('e2e_public_key', publicKeyJWK); // compatibilidad con funciones antiguas de la sesión actual
    }

    if (privateKeyJWK) {
        localStorage.setItem(claveStorageE2E('e2e_private_key', userId), privateKeyJWK);
        localStorage.setItem('e2e_private_key', privateKeyJWK); // compatibilidad con funciones antiguas de la sesión actual
    }
};

const obtenerLlavesLocales = (userId = null) => {
    const privateKeyJWK =
        localStorage.getItem(claveStorageE2E('e2e_private_key', userId)) ||
        localStorage.getItem('e2e_private_key');

    const publicKeyJWK =
        localStorage.getItem(claveStorageE2E('e2e_public_key', userId)) ||
        localStorage.getItem('e2e_public_key');

    if (!privateKeyJWK || !publicKeyJWK) return null;

    if (!clavesCoinciden(publicKeyJWK, privateKeyJWK)) return null;

    return { publicKeyJWK, privateKeyJWK };
};

const obtenerConfiguracionRemotaE2E = async ({ token, apiBaseUrl }) => {
    if (!token || !apiBaseUrl) return null;

    const res = await fetch(`${normalizarBaseUrlApi(apiBaseUrl)}/usuarios/e2e-config`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!res.ok) return null;

    return res.json();
};

const guardarConfiguracionRemotaE2E = async ({ token, apiBaseUrl, publicKeyJWK, privateKeyJWK, password }) => {
    if (!token || !apiBaseUrl || !password) return null;

    const respaldo = await cifrarPrivateKeyConPassword(privateKeyJWK, password);

    const res = await fetch(`${normalizarBaseUrlApi(apiBaseUrl)}/usuarios/e2e-config`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            publicKey: publicKeyJWK,
            ...respaldo
        })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.mensaje || 'No se pudo guardar la configuración E2E.');
    }

    return res.json();
};

// 1. Obtener, generar o sincronizar llaves de usuario.
// - En el mismo dispositivo usa localStorage.
// - En otro dispositivo puede recuperar la llave privada respaldada si recibe la contraseña.
export const obtenerOGenerarLlavesE2E = async (opciones = {}) => {
    const { token = null, apiBaseUrl = '', password = '', userId = null } = opciones || {};
    const idUsuario = userId || obtenerIdUsuarioActual();
    const llavesLocales = obtenerLlavesLocales(idUsuario);
    const configRemota = await obtenerConfiguracionRemotaE2E({ token, apiBaseUrl });

    const tieneRespaldoRemoto = Boolean(
        configRemota?.publicKey &&
        configRemota?.encryptedPrivateKey &&
        configRemota?.e2eSalt &&
        configRemota?.e2eIv
    );

    if (tieneRespaldoRemoto) {
        if (
            llavesLocales &&
            clavesCoinciden(configRemota.publicKey, llavesLocales.privateKeyJWK)
        ) {
            guardarLlavesLocales(llavesLocales, idUsuario);
            return llavesLocales;
        }

        if (!password) {
            if (llavesLocales) return llavesLocales;
            throw new Error('Inicia sesión nuevamente para sincronizar tus mensajes cifrados en este dispositivo.');
        }

        const privateKeyJWK = await descifrarPrivateKeyConPassword({
            encryptedPrivateKey: configRemota.encryptedPrivateKey,
            e2eSalt: configRemota.e2eSalt,
            e2eIv: configRemota.e2eIv,
            password
        });

        let publicKeyJWK = configRemota.publicKey;

        if (!clavesCoinciden(publicKeyJWK, privateKeyJWK)) {
            publicKeyJWK = obtenerPublicKeyDesdePrivateKey(privateKeyJWK);

            await guardarConfiguracionRemotaE2E({
                token,
                apiBaseUrl,
                publicKeyJWK,
                privateKeyJWK,
                password
            });
        }

        const llavesSincronizadas = { publicKeyJWK, privateKeyJWK };
        guardarLlavesLocales(llavesSincronizadas, idUsuario);
        return llavesSincronizadas;
    }

    if (llavesLocales) {
        if (token && apiBaseUrl && password) {
            await guardarConfiguracionRemotaE2E({
                token,
                apiBaseUrl,
                publicKeyJWK: llavesLocales.publicKeyJWK,
                privateKeyJWK: llavesLocales.privateKeyJWK,
                password
            });
        }

        return llavesLocales;
    }

    const nuevasLlaves = await generarParDeLlavesE2E();
    guardarLlavesLocales(nuevasLlaves, idUsuario);

    if (token && apiBaseUrl && password) {
        await guardarConfiguracionRemotaE2E({
            token,
            apiBaseUrl,
            publicKeyJWK: nuevasLlaves.publicKeyJWK,
            privateKeyJWK: nuevasLlaves.privateKeyJWK,
            password
        });
    }

    return nuevasLlaves;
};

export const sincronizarLlavesE2EConCuenta = async ({ token, apiBaseUrl, password, userId = null }) => {
    return obtenerOGenerarLlavesE2E({ token, apiBaseUrl, password, userId });
};

// 2. Cifrar Mensaje (E2E)
export const encriptarMensaje = async (texto, publicKeyReceptorJWK, publicKeyCreadorJWK) => {
    const aesKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const contenidoCifradoBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encoder.encode(texto)
    );

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
        const userId = obtenerIdUsuarioActual();
        const privateKeyJWK =
            localStorage.getItem(claveStorageE2E('e2e_private_key', userId)) ||
            localStorage.getItem('e2e_private_key');

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
