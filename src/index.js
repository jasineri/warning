import fs from 'fs';
import fetch from 'node-fetch';
import core from '@actions/core';
const htmlparser2 = require("htmlparser2");
import nodemailer from 'nodemailer';

(async () => {

    function LinkChecker() {
        const currentLinks = new Set();
        const newLinks = new Set();
        const linksFileName = "data/links.json";

        this.loadLinks = function () {
            if (fs.existsSync(linksFileName)) {
                JSON.parse(fs.readFileSync(linksFileName)).forEach(currentLinks.add, currentLinks);
            }
        }

        this.saveLinks = function () {
            fs.writeFileSync(linksFileName, JSON.stringify(Array.from(newLinks)));
        }

        this.linkExists = function (remoteItemlink) {
            let linkExists = currentLinks.has(remoteItemlink);
            currentLinks.add(remoteItemlink);
            newLinks.add(remoteItemlink);
            return linkExists;
        }
    }

    function ReportMaker() {
        let report = "";
        let linkChecker = new LinkChecker();
        linkChecker.loadLinks();

        async function parseRss(title, url) {
            let res = await fetch(url);
            let html = await res.text();
            let feed = htmlparser2.parseFeed(html);

            let newWarning = false;
            for (let remoteItem of feed.items) {
                if (!linkChecker.linkExists(remoteItem.link)) {
                    if (!newWarning) {
                        report += "<li>*** " + title + " ***</li>"
                    }
                    report += "<a href=\"" + remoteItem.link + "\">"
                        + remoteItem.title
                        + "</a><p>" + remoteItem.description + "</p><br/>";
                    newWarning = true;
                }
            }
        }

        this.parseRssHelper = async function (title, url) {
            try {
                await parseRss(title, url);
            } catch (err) {
                console.log(err);
            }
        }

        this.report = function () {
            if (!("" === report)) {
                let htmlReport = "<html><body>" + report + "</body></html>";
                fs.writeFileSync("warning.html", htmlReport);
                new Mailer().sendMail(htmlReport);
                linkChecker.saveLinks();
            }
        }
    }

    function Mailer() {
        let email = core.getInput("email");
        let pass = core.getInput("email_pass");
        var transporter = nodemailer.createTransport({
            host: 'mail.gmx.net',
            port: 587,
            tls: {
                rejectUnauthorized: true
            },
            auth: {
                user: email,
                pass: pass
            }
        });

        var mailOptions = {
            from: email,
            to: email
        };

        this.sendMail = function (body) {
            mailOptions.html = body;
            mailOptions.subject = "Warning";
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        }
    }

    let reportMaker = new ReportMaker();
    let configs = JSON.parse(fs.readFileSync("config/config.json"));
    for (const config of configs) {
        await reportMaker.parseRssHelper(config.title, config.url);
    }
    reportMaker.report();

})();