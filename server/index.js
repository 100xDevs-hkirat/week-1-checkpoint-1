const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
require('dotenv').config();

app.use(bodyParser.json());
app.use(cors());
const secretKey = process.env.SECRET_KEY;
const mongodb_connection_string = process.env.MONGODB_CONNECTION_STRING;

const adminSchema = new mongoose.Schema({
    username: String,
    password: String
});

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    purchasedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

const courseSchema = new mongoose.Schema({
    title: String,
    description: String,
    price: Number,
    imageLink: String,
    published: Boolean
});

const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Course = mongoose.model('Course', courseSchema);

mongoose.connect(mongodb_connection_string, { dbName: "Courses" });

const authenticateJwt = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
}

app.post('/admin/signup', async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (admin) {
        res.status(403).json({ message: 'Admin already exists' });
    } else {
        await Admin.create({ username, password });
        const token = jwt.sign({ username, role: 'admin' }, secretKey, { expiresIn: '1h' });
        res.status(201).json({ message: 'Admin created successfully', token });
    }
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.headers;
    const admin = await Admin.findOne({ username, password });
    if (admin) {
        const token = jwt.sign({ username, role: 'admin' }, secretKey, { expiresIn: '1h' });
        res.json({ message: 'Logged in successfully', token });
    } else {
        res.status(403).json({ message: 'Invalid credentials' });
    }
});

app.get('/admin/me', authenticateJwt, (req, res) => {
    res.json({
        username: req.user.username
    })
});

app.post('/admin/courses', authenticateJwt, async (req, res) => {
    const course = await Course.create(req.body);
    res.status(201).json({ message: 'Course created successfully', courseId: course._id });
});

app.get('/admin/courses/:courseId', authenticateJwt, async (req, res) => {
    let course = null;
    try {
        course = await Course.findById(req.params.courseId)
    } catch (err) {
        if (!(err instanceof mongoose.Error.CastError)) {
            console.log(e);
        }
    }
    if (course) {
        res.json({course})
    } else {
        res.status(404).json({ message: 'Course not found' })
    }
});

app.put('/admin/courses/:courseId', authenticateJwt, async (req, res) => {
    const course = await Course.findByIdAndUpdate(req.params.courseId, req.body);
    if (course) {
        res.json({ message: 'Course updated successfully' });
    } else {
        res.status(404).json({ message: 'Course not found' });
    }
});

app.get('/admin/courses', authenticateJwt, async (req, res) => {
    const courses = await Course.find({});
    res.json({ courses });
});

app.post('/users/signup', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user) {
        res.status(403).json({ message: 'User already exists' });
    } else {
        await User.create({ username, password })
        const token = jwt.sign({ username, role: 'user' }, secretKey, { expiresIn: '1h' });
        res.status(201).json({ message: 'User created successfully', token });
    }
});

app.post('/users/login', async (req, res) => {
    const { username, password } = req.headers;
    const user = await User.findOne({ username, password });
    if (user) {
        const token = jwt.sign({ username, role: 'user' }, secretKey, { expiresIn: '1h' });
        res.json({ message: 'Logged in successfully', token });
    } else {
        res.status(403).json({ message: 'Invalid credentials' });
    }
});

app.get('/users/me', authenticateJwt, (req, res) => {
    res.json({
        username: req.user.username
    })
});

app.get('/users/courses', authenticateJwt, async (req, res) => {
    const courses = await Course.find({ published: true });
    res.json({ courses });
});

app.get('/users/courses/:courseId', authenticateJwt, async (req, res) => {
    let course = null;
    try {
        course = await Course.findOne({ _id: req.params.courseId, published: true })
    } catch (err) {
        if (!(err instanceof mongoose.Error.CastError)) {
            console.log(e);
        }
    }
    if (course) {
        res.json(course)
    } else {
        res.status(404).json({ message: 'Course not found' })
    }
});

app.post('/users/courses/:courseId', authenticateJwt, async (req, res) => {
    const courseId = req.params.courseId;
    const course = await Course.findOne({ _id: courseId, published: true });
    if (course) {
        const user = await User.findOne({ username: req.user.username });
        if (user) {
            user.purchasedCourses.push(course);
            await user.save();
            res.json({ message: 'Course purchased successfully' });
        } else {
            res.status(403).json({ message: 'User not found' });
        }
    } else {
        res.status(404).json({ message: 'Course not found' });
    }
});

app.get('/users/purchasedCourses', authenticateJwt, async (req, res) => {
    const user = await User.findOne({ username: req.user.username }).populate('purchasedCourses');
    console.log(user.purchasedCourses);
    if (user) {
        res.json({ purchasedCourses: user.purchasedCourses || [] });
    } else {
        res.status(403).json({ message: 'User not found' });
    }
});

app.listen(port, () => {
    console.log(`App listening on http://localhost:${port}`);
});