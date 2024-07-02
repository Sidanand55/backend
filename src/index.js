import dotenv from 'dotenv';
import connectDB from './db/index.js';
// import mongoose from "mongoose";


dotenv.config({
    path: './env'
});

connectDB();

