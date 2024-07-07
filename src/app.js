import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

export const app = express();

app.use(cors({
    origin: [process.env.CORS_ORIGIN],
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


 
// routes import
import userRouter from './routes/user.routes.js'

// routes declaration
app.use("/api/v1/users", userRouter)
// app.post("/posting", (req, res) => {
//     console.log("Request body",req.body)
//     res.status(200).json({
//        message: "ok" 
//     })
// })

// app.get("/test", (req, res) => {
//     res.status(200).json({
//         success: true,
//         message: "API is working",
//     });
// })


// export { app }