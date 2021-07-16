require('dotenv').config();
//const user = require("../model/login");
const { hashing, hashcompare, createJWT } = require("../helper/auth");
const { User, Invoice } = require("../model/schema");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const shortUrl = require('node-url-shortener');
const { NotExtended } = require('http-errors');

const saltRounds = 10;

const getUser = async () => {
    const loginUser = await User.find().exec();
    return loginUser;
}

const registerUser = async (firstname, lastname, email, password, role) => {
    const checkUser = await User.findOne({ email }).exec();
    console.log(checkUser);
    const account = await nodemailer.createTestAccount();
    console.log(account);
    const hash = await hashing(password);
    console.log("===============>" +hash);
    return new Promise(function (resolve, reject) {
        if (!checkUser) {
            const mailer = nodemailer.createTransport({
                name: 'gmail.com',
                host: "smtp.gmail.com",
                port: account.smtp.port,
                secure: account.smtp.secure,
                auth: {
                    user: process.env.sender,
                    pass: process.env.password
                }
            });
            var shrt_url;
            shortUrl.short(`http://localhost:4200/active/${email}`, function (err, url) {
                shrt_url = url;
                console.log(shrt_url);
                let info = mailer.sendMail({
                    from: process.env.sender,
                    to: email, // list of receivers
                    subject: "Account activation ✔", // Subject line
                    text: "Account activation",  // plain text body
                    html: `<a href= "${shrt_url}" >Click on this active account</a>`,
                })
                console.log("---------------> " +shrt_url);
                const newUser = new User({ firstname, lastname, email, role, password: hash, url: shrt_url, status: false }).save();
                const data = { status: 200, msg: "Check your email and activate your account", newUser };
                resolve(data);
            });

        } else {
            if (checkUser.status == false) {
                const hash = bcrypt.hashSync(password, saltRounds);
                const updateData = User.updateOne({ email: email },
                    {
                        firstname: firstname,
                        lastname: lastname,
                        email: email,
                        password: hash,
                        url: shrt_url,
                        status: false
                    });

                const data = { status: 200, msg: "user already exit, please activate your account", updateData };
                resolve(data);
            } else {
                const data = { status: 409, msg: "user already exit" };
                resolve(data);
            }

        }
    })

}

const loginUser = async (email, password) => {
    const checkUser = await User.findOne({ email }).exec();
    //console.log(checkUser);
    if (checkUser) {
        const isUserPassword = await hashcompare(password, checkUser.password);
        if (checkUser.status == false) {
            const data = { status: 401, msg: "user is Inactivate. Please activate your account" };
            return data;
        }
        else if (isUserPassword) {
            const token = await createJWT({
                email: email,
                id: checkUser._id,
            });
            const data = { status: 200, msg: "user is Authenticated", token, checkUser };
            return data;
        } else {
            const data = { status: 401, msg: "incorrect Password" };
            return data;
        }
    } else {
        const data = { status: 403, msg: "user does not exit" };
        return data;
    }
}

const forgotPassword = async (email) => {
    //console.log(email)
    const checkEmail = await User.findOne({ email }).exec();
    console.log(checkEmail);
    if (checkEmail) {

        var string = Math.random().toString(36).substr(2, 10);
        //console.log(string)

        const account = await nodemailer.createTestAccount();
        //console.log(account);
        const mailer = nodemailer.createTransport({
            name: 'gmail.com',
            host: "smtp.gmail.com",
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
                user: process.env.sender,
                pass: process.env.password
            }
        });

        let info = await mailer.sendMail({
            from: process.env.sender,
            to: checkEmail.email, // list of receivers
            subject: "Password Reset ✔", // Subject line
            text: "Password Reset Ramdom String",  // plain text body
            html: `<a href="http://localhost:4200/reset/${email}/${string}">Click on this link</a>`,
        });
        console.log("------------->" + string);
        console.log("=============>" + checkEmail.email);
        const updateString = await User.updateOne({ email: checkEmail.email }, {
            randomString: string
        });
        console.log(updateString);
        const data = { status: 200, msg: "Check your email and reset your password", updateString };
        return data
    } else {
        const data = { status: 403, msg: "user does not registered" };
        return data;
    }

}

const verfiyString = async (email, randomString) => {
    const checkUser = await User.findOne({ email: email, randomString: randomString }).exec();
    console.log(checkUser);
    if (checkUser) {
        const data = { status: 200, msg: "string verified" };
        return data;
    } else {
        const data = { status: 403, msg: "reset url is expired" };
        return data;
    }
}

const resetPassword = async (email, password) => {

    const hash = bcrypt.hashSync(password, saltRounds);
    const updateString = await User.updateOne({ email: email }, {
        password: hash
    });

    const data = { status: 200, msg: "password updated successfully", updateString };
    return data;
}

const expireString = async (email) => {


    const expire_string = await User.updateOne({ email: email }, {
        randomString: ""
    });

    const data = { status: 200, msg: "Random String is expired", expire_string };
    //console.log(data);
}

const activateAccount = async (email) => {

    const checkUser = await User.findOne({ email: email }).exec();
    console.log(checkUser.status);
    if (checkUser.status == false) {
        const activate = await User.updateOne({ email: email }, {
            status: true
        });
        const data = { status: 200, msg: "user account activated", activate };
        return data
    }
    else {
        const data = { status: 403, msg: "user already activated and check login" };
        return data;
    }

}

const addInvoice = async (reqdata) => {
    const checkInvoice = await Invoice.findOne({ invoiceName: reqdata.invoiceName }).exec();

    if (!checkInvoice) {
        const checkUser = await User.findOne({ role: "Admin" }).exec();
        console.log(checkUser);
        const newInvoice = await new Invoice(reqdata).save();
        const data = { status: 200, msg: "Invoice created and sent a mail to Admin", newInvoice };

        const account = await nodemailer.createTestAccount();
        //console.log(account);
        const mailer = nodemailer.createTransport({
            name: 'gmail.com',
            host: "smtp.gmail.com",
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
                user: process.env.sender,
                pass: process.env.password
            }
        });

        let info = await mailer.sendMail({
            from: process.env.sender,
            to: checkUser.email, // list of receivers
            subject: "Invoice Creation ✔", // Subject line
            text: "Invoice Creation",  // plain text body
            html: `<p>New Invoice created successfully. <b>Invoice Id:${newInvoice.invoiceName}</b></p>`,
        });

        return data


    } else {
        const data = { status: 409, msg: "Invoice already exit" };
        return data
    }

}

const selectInvoice = async (reqdata) => {
    const invoiceData = await Invoice.find(reqdata).exec();
    return invoiceData;
}

const getInvoice = async () => {
    const invoiceData = await Invoice.find().exec();
    return invoiceData;
}

module.exports = {
    getUser,
    registerUser,
    loginUser,
    forgotPassword,
    expireString,
    verfiyString,
    resetPassword,
    activateAccount,
    addInvoice,
    getInvoice,
    selectInvoice
}