import { get } from 'axios';
import elasticsearch from 'elasticsearch';
import { sortBy } from 'lodash';

const es = new elasticsearch.Client({
  host: 'localhost:9200',
});

function fetchFlightData() {
  return get(
    'http://public-api.adsbexchange.com/VirtualRadar/AircraftList.json?lat=33.433638&lng=-112.008113&fDstL=0&fDstU=100'
  ).then(resp => resp.data.acList);
}

function indexFlightData() {
  return fetchFlightData()
    .then(list => sortBy(list, 'Lat'))
    .then(list => {
      list.forEach(ac => {
        ac['@timestamp'] = new Date(ac.PosTime).getTime();
        ac.location = {
          lat: ac.Lat,
          lon: ac.Long,
        };

        es.index({
          index: 'adsb',
          type: 'ac',
          id: `${ac.Id}-${ac.PosTime}`,
          body: ac,
        });
      });
      return true;
    });
}

function go() {
  indexFlightData().then(() => setTimeout(go, 5000));
}

es.indices
  .create({
    index: 'adsb',
    body: {
      settings: {
        number_of_shards: 1,
      },
      mappings: {
        ac: {
          properties: {
            location: { type: 'geo_point' },
            '@timestamp': { type: 'date' },
          },
        },
      },
    },
  })
  .then(go)
  .catch(go);
