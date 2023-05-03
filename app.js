const express = require("express");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = "sqlite";
const sqlite3 = "sqlite3";
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () =>
      console.log("Server running at http://localhost:3001/")
    );
  } catch (error) {
    console.log(`DBError: ${error.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const convertStateObject = (dbOfObject) => {
  return {
    stateId: dbOfObject.state_id,
    stateName: dbOfObject.state_name,
    population: dbOfObject.population,
  };
};

const convertDistrictObject = (dbOfObject) => {
  return {
    districtId: dbOfObject.district_id,
    districtName: dbOfObject.district_name,
    stateId: dbOfObject.state_id,
    cases: dbOfObject.cases,
    cured: dbOfObject.cured,
    active: dbOfObject.active,
    deaths: dbOfObject.deaths,
  };
};

const convertSnakeToCamelCase = (dbObject) => {
  return {
    totalCases: dbObject.cases,
    totalCured: dbObject.cured,
    totalActive: dbObject.active,
    totalDeaths: dbObject.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "COV_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const SelectUserQuery = `SELECT * FROM user WHERE username = "${username}"`;
  const dbUser = await db.run(SelectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordValid = await bcrypt.compare(password, dbUser.password);
    if (isPasswordValid === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "COV_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticationToken, async (request, response) => {
  const getStateQuery = `SELECT * FROM state`;
  const stateQuery = await db.all(getStateQuery);
  response.send(stateQuery.map((eachState) => convertStateObject(eachState)));
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateArray = `SELECT * FROM state WHERE state_id = "${stateId}"`;
  const stateArray = await db.get(getStateArray);
  response.send(convertStateObject(stateArray));
});

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) VALUES ("${districtName}","${stateId}","${cases}","${cured}","${active}","${deaths}"`;
  const districtQuery = await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = "${districtId}"`;
    const districtQuery = await db.get(getDistrictQuery);
    response.send(convertDistrictObject(districtQuery));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = "${districtId}"`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const putDistrictQuery = `UPDATE 
                                    district 
                                SET 
                                    district_name = "${districtName}",
                                    state_id = "${stateId}",
                                    cases = "${cases}",
                                    cured = "${cured}",
                                    active = "${active}",
                                    deaths = "${deaths}" 
                                WHERE 
                                    district_id = "${districtId}"`;
    await db.run(putDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatesArray = `SELECT 
                                  SUM(cases),
                                  SUM(cured),
                                  SUM(active),
                                  SUM(deaths) 
                              FROM 
                                  district
                              WHERE
                                  state_id = "${stateId}"`;
    const stateQuery = await db.get(getStatesArray);
    response.send(convertSnakeToCamelCase(stateQuery));
  }
);

module.exports = app;
