const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary.config");

const {
    MAX_UPLOAD_SIZE_BYTES
} = require("./uploads.config");

const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {

        let folder = "legacy";
        let resource_type = "auto";

        if (file.mimetype.startsWith("image/")) {
            folder = "legacy/images";
        }

        if (file.mimetype.startsWith("video/")) {
            folder = "legacy/videos";
        }

        return {
            folder,
            resource_type,
            use_filename: true,
            unique_filename: true
        };
    }
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