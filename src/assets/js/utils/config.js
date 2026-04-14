/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const pkg = require('../package.json');
const nodeFetch = require("node-fetch");
const convert = require('xml-js');

const baseUrl = pkg.url;
const configUrl   = `${baseUrl}/config`;
const articlesUrl = `${baseUrl}/articles`;

class Config {
    GetConfig() {
        return new Promise((resolve, reject) => {
            nodeFetch(configUrl).then(async res => {
                if (res.status === 200) return resolve(res.json());
                else return reject({ error: { code: res.statusText, message: 'server not accessible' } });
            }).catch(error => {
                return reject({ error });
            })
        })
    }

    async getInstanceList() {
        return this.GetConfig().then(cfg => cfg.instances || []).catch(err => {
            console.error('[Config] Failed to fetch instance list:', err);
            return [];
        });
    }

    async getNews(config) {
        if (config.rss) {
            return new Promise((resolve, reject) => {
                nodeFetch(config.rss).then(async res => {
                    if (res.status === 200) {
                        let news = [];
                        let response = await res.text()
                        response = (JSON.parse(convert.xml2json(response, { compact: true })))?.rss?.channel?.item;

                        if (!Array.isArray(response)) response = [response];
                        for (let item of response) {
                            news.push({
                                title: item.title._text,
                                content: item['content:encoded']._text,
                                author: item['dc:creator']._text,
                                publish_date: item.pubDate._text
                            })
                        }
                        return resolve(news);
                    }
                    else return reject({ error: { code: res.statusText, message: 'server not accessible' } });
                }).catch(error => reject({ error }))
            })
        } else {
            return new Promise((resolve, reject) => {
                nodeFetch(articlesUrl).then(async res => {
                    if (res.status === 200) return resolve(res.json());
                    else return reject({ error: { code: res.statusText, message: 'server not accessible' } });
                }).catch(error => {
                    return reject({ error });
                })
            })
        }
    }
}

export default new Config;