class ExpressError extends Error {
    constructor(statusCode, message) {
        super();
        this.statusCode = statusCode || 500; // Default to 500 if no statusCode is provided
        this.message = message;
    }
}

module.exports = ExpressError;
