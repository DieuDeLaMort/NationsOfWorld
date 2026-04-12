/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const pkg = require('../package.json');
const nodeFetch = require("node-fetch");
const convert = require('xml-js');
let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url

let config = `${url}/config`;
let articles = `${url}/articles`;

class Config {
    GetConfig() {
        return new Promise((resolve, reject) => {
            nodeFetch(config).then(async config => {
                if (config.status === 200) return resolve(config.json());
                else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
            }).catch(error => {
                return reject({ error });
            })
        })
    }

    async getInstanceList() {
        return [
            {
                name: "Nations Of World - Résurgence",
                url: `${url}/files`,
                loader: {
                    minecraft_version: "1.20.1",
                    loader_type: "forge",
                    loader_version: "47.4.0"
                },
                verify: true,
                ignored: ["logs", "screenshots", "saves", "resourcepacks", "shaderpacks", "options.txt", "optionsof.txt"],
                jvm_args: [],
                game_args: [],
                status: {
                    nameserver: "Nations Of World - Résurgence",
                    ip: "play.nationsofworld.fr",
                    port: 25565
                },
                whitelistActive: false,
                whitelist: []
            }
        ]
    }

    async getNews(config) {
        if (config.rss) {
            return new Promise((resolve, reject) => {
                nodeFetch(config.rss).then(async config => {
                    if (config.status === 200) {
                        let news = [];
                        let response = await config.text()
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
                    else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
                }).catch(error => reject({ error }))
            })
        } else {
            return new Promise((resolve, reject) => {
                nodeFetch(articles).then(async config => {
                    if (config.status === 200) return resolve(config.json());
                    else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
                }).catch(error => {
                    return reject({ error });
                })
            })
        }
    }
}

export default new Config;