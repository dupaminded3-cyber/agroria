const multer = require('multer');

const MAX_FOTOS = 50;
const MAX_BESTANDSGROOTTE = 12 * 1024 * 1024; // 12 MB per foto

const toegestaneTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function fileFilter(req, file, cb) {
  if (toegestaneTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Alleen foto\'s (JPG, PNG, WEBP of HEIC) zijn toegestaan.'));
  }
}

const offerteUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BESTANDSGROOTTE, files: MAX_FOTOS },
  fileFilter,
});

const enkeleAfbeeldingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BESTANDSGROOTTE, files: 1 },
  fileFilter,
});

module.exports = { offerteUpload, enkeleAfbeeldingUpload, MAX_FOTOS, MAX_BESTANDSGROOTTE };
