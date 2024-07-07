import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";  

const userSchema= new mongoose.Schema(
    {
        username :{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true  //searching field agar enable krni hai 
        },
        email:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true, 
        },
        fullname:{
            type: String,
            required: true,
            trim: true, 
            index: true,
        },
        avatar:{
            type: String, //cloudinary url
            required: true,
        },
        coverImage:{
            type: String, //cloudinary url
        },
        watchHistory:[
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Video",
            }
        ],
        paswword:{
            type:String,
            required: [true, 'Password is required']   // can also upload a custom message
        },
        refreshToken: {
            type:String,
        }

    },{timestamps :true}
);

// encrypting the password
userSchema.pre("save", async function(next) {
    if(!this.isModified("password")) return next()   // agar yeh nhi krege toh hrr baar password alag encrypt hoga
                                                    // isiliye jb update ho ya first time ho tb hi encrypt krenge
    this.password= await bcrypt.hash(this.password, 10)  
    next()
})

// checking the password if the entred is true
userSchema.methods.isPasswordCorrect= async function(password){
    return await bcrypt.compare(password, this.password)
}


userSchema.methods.generateAccessToken= function(){
    return jwt.sign(
        {
            _id: this._id ,  //mongo db se milega
            email: this.email, // right wali cheezein database se aarhi hai
            username: this.username,
            fullname: this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefresToken = function(){
    return jwt.sign(
        {
            _id: this._id ,  //mongo db se milega
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}


export const  User = mongoose.model("User", userSchema)