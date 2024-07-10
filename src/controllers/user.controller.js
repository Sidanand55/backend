import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens= async(userId) =>{
    try{
        const user =await User.findById(userId);
        if (!user) {
            console.error(`User with ID ${userId} not found.`);
            throw new ApiError(404, "User not found");
        }
        const accessToken= user.generateAccessToken()
        const refreshToken= user.generateRefreshToken()
        // console.log("access token: ",accessToken);
        // console.log("refresh token: ",refreshToken);

        // storing in db 
        user.refreshToken= refreshToken
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};

    }catch(error){
        console.log(`Error generationg tokens for user ID ${userId}: `, error);
        throw new ApiError(500, "Something went wrong while generation refresh and access token")
    }
}


const registerUser = asyncHandler(async( req, res)=> {
    // console.log("Request body",req.body)
    // res.status(200).json({
    //    message: "ok" 
    // })

    // get user details from front end
    // validation  - not empty
    // check if user already exists : username , email
    // check for images, check for avatar
    // upload them to cloudinary , avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response 


    const {fullname, email, username, password} = req.body
    console.log("email: ", email);
    console.log("fullname:" , fullname);

    // if(fullName === ""){
    //     throw new ApiError(400, "fullname is required")
    // }
    // validation
    if(
        [fullname, email, username,password].some((field) =>
            field?.trim()=== "")
    ){
        throw new ApiError(400, "All fields are required")
    }

    const existedUser= await User.findOne({
        $or: [{ username }, { email }]   //checking if username or email exists in our db
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
    }

    // check 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath= req.files?.coverImage[0].path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath= req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }

    const user = await User.create({
        fullname,
        avatar : avatar.url, 
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"   //- means nhi chaiye (not select)
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

const loginUser = asyncHandler(async(req, res)=>{
    //  req body -> data
    // username or email
    // find the user
    // password check
    // access and refresh token 
    // send in form of cookies 

    const {email, username, password} = req.body
    // kisi se bhi login krwane ke liye ek hi field
    if(!(username || email)){
        throw new ApiError(400, "Username or email is required");
    }

    const user= await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid= await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials");
    }

    const {accessToken, refreshToken}= await generateAccessAndRefreshTokens(user._id);

    
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")  //jo cheezein nhi chaiye

    // send in cookies
    const options = {
        httpOnly: true,    //yeh cook
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken,options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken  // user khud local storage mei save krna chah rha ho 
            },
            "User logged In Successfully"
        )

    )


})


const logoutUser = asyncHandler(async(req, res)=>{
     
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },{
            new: true
        }
    )

    const options = {
        httpOnly: true,    //yeh cookie
        secure: true
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))


})


// creating end pt to regenerate refresh token
const refreshAccessToken=  asyncHandler(async(req, res)=>{
    
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken=  jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user= await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"Invalid refresh token");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh Token is expired or used");
        }
    
        const options= {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options) 
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})


const changeCurrentPassword= asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword}= req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password")
    }

    user.password= newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))

})


// getting current user
const getCurrentUser = asyncHandler(async(req,res)=> {
    return res
    .status(200)
    .json(200, req.user, "current user fetched successfully")
})

const updateAccountDetails= asyncHandler(async(req, res)=> {
    const {fullname, email}= req.body
    
    if(!fullname || !email){
        throw new ApiError(400, "All fields are required");
    }

    const user= User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email
            }
        },
        {new:true}  // updated wali return hogi
    
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))

})


const updateUserAvatar= asyncHandler(async(req,res)=>{

    const avatarLocalPath = req.file?.path 

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath) 

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar  image updated successfully")
    )
})

const updateUserCoverImage= asyncHandler(async(req,res)=>{

    const coverImageLocalPath = req.file?.path 

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath) 

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading coverImage")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )

})



export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails,updateUserAvatar, updateUserCoverImage};