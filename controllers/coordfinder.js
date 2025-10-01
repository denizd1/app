const fs = require("fs");
const path = require("path");
const booleanPointInPolygon = require("@turf/boolean-point-in-polygon");
const booleanIntersects = require("@turf/boolean-intersects");
const intersection = require("@turf/intersect");
const turfpolygon = require("turf-polygon");
const turfmultiPolygon = require("turf-multipolygon");

// Always resolve from project root
const dataDir = path.join(__dirname, "..");

const pafta25000 = JSON.parse(
  fs.readFileSync(path.join(dataDir, "pafta25000.geojson"), "utf8")
);
const pafta100000 = JSON.parse(
  fs.readFileSync(path.join(dataDir, "pafta100000.geojson"), "utf8")
);
const pafta500000 = JSON.parse(
  fs.readFileSync(path.join(dataDir, "pafta500000.geojson"), "utf8")
);
const cities = JSON.parse(
  fs.readFileSync(path.join(dataDir, "tr-cities-utf8.geojson"), "utf8")
);
const districts = JSON.parse(
  fs.readFileSync(path.join(dataDir, "tr_ilce.geojson"), "utf8")
);

//check if point is in polygon. If yes then return yirmibes, yuz, besyuz, il, ilce
const checkPointInPolygon = (lat, lon) => {
  console.log("Checking point in polygon for:", lat, lon);
  const isInside25 = pafta25000.features.find((polygon) =>
    booleanPointInPolygon.default([lat, lon], polygon.geometry)
  );
  const isInside100 = pafta100000.features.find((polygon) =>
    booleanPointInPolygon.default([lat, lon], polygon.geometry)
  );
  const isInside500 = pafta500000.features.find((polygon) =>
    booleanPointInPolygon.default([lat, lon], polygon.geometry)
  );
  const isInsideCity = cities.features.find((polygon) =>
    booleanPointInPolygon.default([lat, lon], polygon.geometry)
  );
  const isInsideDistrict = districts.features.find((polygon) =>
    booleanPointInPolygon.default([lat, lon], polygon.geometry)
  );

  var thisyirmibes = isInside25.properties.STD_ID1.toUpperCase();
  var thisyuz = isInside100.properties.STD_ID1;
  var thisbesyuz = isInside500.properties.STD_ID1;
  var thisil =
    isInsideCity.properties.name.charAt(0) +
    isInsideCity.properties.name.substring(1).toLocaleLowerCase("tr");

  var thisilce =
    isInsideDistrict.properties.STD_ID1.charAt(0) +
    isInsideDistrict.properties.STD_ID1.substring(1).toLocaleLowerCase("tr");

  return {
    yirmibes: thisyirmibes,
    yuz: thisyuz,
    besyuz: thisbesyuz,
    il: thisil,
    ilce: thisilce,
  };
};
//check if polygon intersects with other polygons. If yes then return yirmibes, yuz, besyuz, il, ilce
const intersectionCheck = (inputpoly) => {
  var pafta25list = [];
  var pafta100list = [];
  var pafta500list = [];
  var citylist = [];
  var districtlist = [];

  pafta25000.features.forEach((polygon) => {
    if (
      intersection.default(
        turfpolygon(polygon.geometry.coordinates),
        turfpolygon(inputpoly.features[0].geometry.coordinates)
      )
    ) {
      pafta25list.push(polygon.properties.STD_ID1.toUpperCase());
    }
  });
  pafta100000.features.forEach((polygon) => {
    if (
      intersection.default(
        turfpolygon(polygon.geometry.coordinates),
        turfpolygon(inputpoly.features[0].geometry.coordinates)
      )
    ) {
      pafta100list.push(polygon.properties.STD_ID1);
    }
  });
  pafta500000.features.forEach((polygon) => {
    if (
      intersection.default(
        turfpolygon(polygon.geometry.coordinates),
        turfpolygon(inputpoly.features[0].geometry.coordinates)
      )
    ) {
      pafta500list.push(polygon.properties.STD_ID1);
    }
  });
  cities.features.forEach((polygon) => {
    if (
      intersection.default(
        turfmultiPolygon(polygon.geometry.coordinates),
        turfpolygon(inputpoly.features[0].geometry.coordinates)
      )
    ) {
      citylist.push(
        polygon.properties.name.charAt(0) +
          polygon.properties.name.substring(1).toLocaleLowerCase("tr")
      );
    }
  });
  districts.features.forEach((polygon) => {
    if (
      intersection.default(
        turfmultiPolygon(polygon.geometry.coordinates),
        turfpolygon(inputpoly.features[0].geometry.coordinates)
      )
    ) {
      districtlist.push(
        polygon.properties.STD_ID1.charAt(0) +
          polygon.properties.STD_ID1.substring(1).toLocaleLowerCase("tr")
      );
    }
  });

  return {
    yirmibes: pafta25list,
    yuz: pafta100list,
    besyuz: pafta500list,
    il: citylist,
    ilce: districtlist,
  };
};
//check if line intersects with polygon. If yes then return yirmibes, yuz, besyuz, il, ilce
const intersectionCheckLine = (line) => {
  var pafta25list = [];
  var pafta100list = [];
  var pafta500list = [];
  var citylist = [];
  var districtlist = [];

  pafta25000.features.forEach((polygon) => {
    if (
      booleanIntersects.default(turfpolygon(polygon.geometry.coordinates), line)
    ) {
      pafta25list.push(polygon.properties.STD_ID1.toUpperCase());
    }
  });
  pafta100000.features.forEach((polygon) => {
    if (
      booleanIntersects.default(turfpolygon(polygon.geometry.coordinates), line)
    ) {
      pafta100list.push(polygon.properties.STD_ID1);
    }
  });
  pafta500000.features.forEach((polygon) => {
    if (
      booleanIntersects.default(turfpolygon(polygon.geometry.coordinates), line)
    ) {
      pafta500list.push(polygon.properties.STD_ID1);
    }
  });
  cities.features.forEach((polygon) => {
    if (
      booleanIntersects.default(
        turfmultiPolygon(polygon.geometry.coordinates),
        line
      )
    ) {
      citylist.push(
        polygon.properties.name.charAt(0) +
          polygon.properties.name.substring(1).toLocaleLowerCase("tr")
      );
    }
  });
  districts.features.forEach((polygon) => {
    if (
      booleanIntersects.default(
        turfmultiPolygon(polygon.geometry.coordinates),
        line
      )
    ) {
      districtlist.push(
        polygon.properties.STD_ID1.charAt(0) +
          polygon.properties.STD_ID1.substring(1).toLocaleLowerCase("tr")
      );
    }
  });

  return {
    yirmibes: pafta25list,
    yuz: pafta100list,
    besyuz: pafta500list,
    il: citylist,
    ilce: districtlist,
  };
};

module.exports = {
  checkPointInPolygon,
  intersectionCheck,
  intersectionCheckLine,
};
