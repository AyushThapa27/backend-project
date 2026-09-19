import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiErr } from "../utils/ApiErr.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jwt";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiErr(
      500,
      "Something went wrong while generating Access and Refresh Token."
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user detail from frontend
  //validation - not empty
  //user already exists : username,email
  //check for images ,check for avatars
  //upload images to choudinary, avatar
  //create user object-create entry in db
  //remove password and refresh token field form response
  //check for user creation
  //return response

  // console.log("\n---------------req.body------------------\n");
  // console.log(req.body);

  // console.log("\n---------------req.file------------------\n");
  // console.log(req.files);

  const { username, fullName, password, email } = req.body || {};

  if (
    [username, fullName, password, email].some((field) => {
      return field?.trim() === "";
    }) ||
    !username ||
    !fullName ||
    !password ||
    !email
  ) {
    throw new ApiErr(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiErr(409, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiErr(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiErr(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiErr(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //get data from user.body
  //username or email
  //find the user
  //password check
  //generate access and refresh token for user
  //send cookies

  const { email, username, password } = req.body;
  if ((!username && !email) || !password) {
    throw new ApiErr(400, "Username/email and password are required.");
  }

  const user = await User.findOne({ $or: [{ username }, { email }] });

  if (!user) {
    throw new ApiErr(404, "User does not exists");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiErr(401, "Password incorrect");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In Successfully..."
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out Successfully..."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incommingRefreshToken =
      req.cookies?.refreshToken || req.body.refreshToken;

    if (!incommingRefreshToken) {
      throw new ApiErr(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiErr(401, "Invalid refresh token");
    }

    if (incommingRefreshToken !== user?.refreshToken) {
      throw new ApiErr(401, "Refresh Token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    res
      .status(200)
      .cookie("accessToken", newAccessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken: newAccessToken, refreshToken: newRefreshToken },
          "Access Token Refreshed"
        )
      );
  } catch (error) {
    throw new ApiErr(401, error?.message || "Invalid Refresh Token");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
