class GalleryError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "GalleryError";
    this.status = status;
    this.code = code;
  }
}

module.exports = { GalleryError };
