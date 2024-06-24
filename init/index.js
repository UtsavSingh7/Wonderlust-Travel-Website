const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const Mongo_url = 'mongodb://127.0.0.1:27017/wonderlastt';

main().then(() => {
    console.log("Connected to db");
}).catch((err) => {
    console.error("Failed to connect to db", err);
});

async function main() {
    await mongoose.connect(Mongo_url);
}

const initDB = async () => {
    await Listing.deleteMany({});

    // Assuming each object in initData.data already has an `owner` property
    // Example: { title: 'Some Title', description: 'Some Description', owner: 'Owner Name' }
    const listingsWithOwner = initData.data.map(obj => ({
        ...obj,
        // Assigning a default owner if not already provided in initData.data
        owner: "652d0081ae547c5d37e56b5f"
    }));

    await Listing.insertMany(listingsWithOwner);
    console.log("Data was initialized");
}

initDB();
