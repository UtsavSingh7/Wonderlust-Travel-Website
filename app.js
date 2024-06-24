const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing");
const Review = require("./models/review");
const path = require("path");
const bodyParser = require('body-parser');
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");
const { listingSchema, reviewSchema } = require("./schema");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const session = require('express-session');
const flash = require('connect-flash');
const { isLoggedIn } = require("./middleware");

// Middleware to parse URL-encoded data (form data)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // To parse JSON data
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, "/public")));

// Setting the view engine and views directory
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database connection
const Mongo_url = 'mongodb://127.0.0.1:27017/wonderlastt';

async function main() {
    try {
        await mongoose.connect(Mongo_url, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to db");
    } catch (err) {
        console.error("Failed to connect to db", err);
    }
}

main();

// Session configuration
const sessionOptions = {
    secret: 'thisshouldbeabettersecret!',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: false, // set to true in production for HTTPS
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 1 week
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware to handle flash messages and current user
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user; // Make currentUser available in all templates
    next();
});

// Routes
app.get("/", (req, res) => {
    res.redirect("/listings/index ");
});

app.get("/signup", (req, res) => {
    res.render("users/signup", { errors: [] });
});




app.post('/signup', async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ email, username });
        await User.register(newUser, password);
        req.login(newUser, (err) => {
            if (err) {
                return next(err);
            }
            req.flash('success', 'Welcome to Wanderlust!');
            res.redirect('/listings');
        });
    } catch (error) {
        console.log(error);
        req.flash('error', error.message);
        res.redirect('/signup');
    }
});

app.get("/login", (req, res) => {
    res.render("users/login", { errors: [] });
});

app.post("/login", passport.authenticate("local", { failureRedirect: "/login", failureFlash: true }), (req, res) => {
    req.flash('success', 'Welcome back!');
    let redirectUrl = req.session.returnTo || "/listings";
    delete req.session.returnTo;
    res.redirect(redirectUrl);
});

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "Logged out successfully");
        res.redirect("/listings");
    });
});

const validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);
    if (error) {
        const errMsg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

const validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body);
    if (error) {
        const errMsg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

app.get('/listings', wrapAsync(async (req, res) => {
    const allListing = await Listing.find({});
    res.render('listings/index', { allListing });
}));

app.get("/listings/new", isLoggedIn, (req, res) => {
    res.render("listings/new");
});

app.get("/listings/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate('reviews').populate("owner");
    if (!listing) {
        throw new ExpressError(404, "Listing not found");
    }
    res.render("listings/show", { listing });
}));

app.post("/listings", validateListing, isLoggedIn, wrapAsync(async (req, res, next) => {
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    await newListing.save();
    req.flash('success', 'Successfully created a new listing!');
    res.redirect("/listings");
}));

app.get("/listings/:id/edit", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw new ExpressError(404, "Listing not found");
    }
    res.render("listings/edit", { listing });
}));

app.put("/listings/:id", validateListing, isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    if (!listing) {
        throw new ExpressError(404, "Listing not found");
    }
    req.flash('success', 'Successfully updated the listing!');
    res.redirect(`/listings/${id}`);
}));

app.delete("/listings/:id", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash('success', 'Successfully deleted the listing!');
    res.redirect("/listings");
}));

app.post("/listings/:id/reviews", validateReview, isLoggedIn, wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    const newReview = new Review(req.body.review);
    listing.reviews.push(newReview);
    await newReview.save();
    await listing.save();
    req.flash('success', 'Successfully added a new review!');
    res.redirect(`/listings/${req.params.id}`);
}));

app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page not found"));
});

app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("listings/error", { message });
});

app.listen(8000, () => {
    console.log("Server is listening at port 8000");
});
