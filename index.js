const express = require("express");
const axios = require("axios");
const redis = require("redis");

const app = express();
const port = process.env.PORT || 3000;

let redisClient;

(async () => {
    redisClient = redis.createClient();
    redisClient.on("error", (error) => console.error(`Error : ${error}`));
    await redisClient.connect();
})();

async function fetchApiData(species) {
    const apiResponse = await axios.get(`https://www.fishwatch.gov/api/species/${species}`);
    console.log("Request sent to the API");
    return apiResponse.data;
}

async function cacheData(req, res, next) {
    const species = req.params.species;
    let results;
    try {
        const cacheResults = await redisClient.get(species);
        if (cacheResults) {
            console.log("Results fetched from Redis Cache");
            res.send({
                fromCache: true,
                data: JSON.parse(cacheResults)
            });
        } else {
            next();
        }
    } catch (error) {
        console.error(error);
        res.status(404);
    }
}

async function getSpeciesData(req, res) {
    const species = req.params.species;
    let results;
    try {
        results = await fetchApiData(species);
        if (results.length === 0) {
            throw "API returned an empty array";
        }
        await redisClient.set(species, JSON.stringify(results), {
            EX: 180,
            NX: true,
        });
        res.send({
            fromCache: false,
            data: results,
        });
    } catch (error) {
        console.error(error);
        res.status(404).send("Data unavailable");
    }
}

app.get("/fish/:species", cacheData, getSpeciesData);

app.listen(port, () => console.log(`The server is running on port ${port}`));
