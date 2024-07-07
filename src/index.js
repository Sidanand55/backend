import dotenv from 'dotenv';
import connectDB from './db/index.js';
import express from 'express'
import {app} from "./app.js"
import http from "http"
const server = http.createServer(app)

dotenv.config({
    path: './env'
})

connectDB()
.then(()=> {
    console.log("MongoDB connected");
})
.catch((err)=>{
    console.log("MongoDB connection failed", err);
})


server.listen(process.env.PORT || 8000, ()=>{
    console.log(`Server is running on port ${process.env.PORT}`);
})
