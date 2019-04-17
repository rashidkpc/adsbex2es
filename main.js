import { get } from 'axios';
import elasticsearch from 'elasticsearch';
import { sortBy } from 'lodash';

const es = new elasticsearch.Client({
  host: 'localhost:9200',
});

function fetchFlightData() {
  return get(
    'http://public-api.adsbexchange.com/VirtualRadar/AircraftList.json?lat=33.433638&lng=-112.008113&fDstL=0&fDstU=100'
  )
    .then(resp => resp.data.acList)
    .catch(e => {
      console.log('FLIGHT FAILURE', e);
    });
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
        ac.Spd = Math.round(ac.Spd);

        es.index({
          index: 'adsb',
          id: `${ac.Id}-${ac.PosTime}`,
          type: '_doc',
          body: ac,
        })
          .then(() => process.stdout.write('.'))
          .catch(e => console.log('INDEXING FAILURE', e));
      });

      return true;
    });
}

function go() {
  indexFlightData().then(() => setTimeout(go, 2000));
}

es.indices
  .create({
    index: 'adsb',
    body: {
      settings: {
        number_of_shards: 1,
      },
      mappings: {
        properties: {
          location: { type: 'geo_point' },
          '@timestamp': { type: 'date' },
        },
      },
    },
  })
  .then(go)
  .catch(e => {
    console.log('MAPPING FAILURE', e);
    go();
  });
