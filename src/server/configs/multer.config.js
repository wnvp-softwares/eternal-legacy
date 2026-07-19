const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const cloudinary = require("./cloudinary.config");
const {
    MAX_UPLOAD_SIZE_BYTES
} = require("./uploads.config");

const storage = new CloudinaryStorage({

    cloudinary,

    params: async (req, file) => ({

        folder: "uploads",

        resource_type: "auto",

        public_id: `${Date.now()}-${Math.round(Math.random() * 1E9)}`

    })

});

const upload = multer({

    storage,

    limits: {

        fileSize: MAX_UPLOAD_SIZE_BYTES

    },

    fileFilter(req, file, cb) {

        if (
            file.mimetype.startsWith("image/") ||
            file.mimetype.startsWith("video/")
        ) {
            return cb(null, true);
        }

        cb(new Error("Formato no soportado"));
    }

});

module.exports = upload;