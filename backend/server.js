const express = require('express');
require('dotenv').config();
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');
const upload = multer({ dest: 'uploads/' }); // Temporary storage

const app = express();
const PORT = 3000;
app.use(bodyParser.json({ limit: '10mb' }));

// Middleware
app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

// SSL certificate
const caCert = fs.readFileSync('./ca.pem');

// MySQL connection
const db = mysql.createConnection({
  host: 'mysql-21b25648-kiot-b88b.g.aivencloud.com',
  user: 'avnadmin',
  password: 'AVNS_keLwIKc7PG8AQnC9pV-',
  database: 'defaultdb',
  port: 20273,
  connectTimeout: 10000,
  ssl: {
    ca: caCert,
    rejectUnauthorized: true
  }
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
});


function sendEmail({ recipient_email, OTP }) {
  return new Promise((resolve, reject) => {
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MY_EMAIL,
        pass: process.env.MY_PASSWORD,
      },
    });

    const mail_configs = {
      from: process.env.MY_EMAIL,
      to: recipient_email,
      subject: 'PASSWORD RECOVERY',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>OTP Email Template</title>
        </head>
        <body>
        <div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
          <div style="margin:50px auto;width:70%;padding:20px 0">
            <div style="border-bottom:1px solid #eee">
              <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">Chennai Siddha Viddhai</a>
            </div>
            <p style="font-size:1.1em">Hi,</p>
            <p>Use the following OTP to complete your Password Recovery Procedure. OTP is valid for 5 minutes</p>
            <h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">${OTP}</h2>
            <p style="font-size:0.9em;">Regards,<br />Chennai Siddha Viddhai</p>
            <hr style="border:none;border-top:1px solid #eee" />
            <div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300">
              <p>Chennai Siddha Viddhai</p>
              <p>CSE C</p>
              <p>KIOT</p>
            </div>
          </div>
        </div>
        </body>
        </html>`,
    };

    transporter.sendMail(mail_configs, function (error, info) {
      if (error) {
        console.error('Error sending email:', error);
        return reject({ message: 'An error has occurred' });
      }
      return resolve({ message: 'Email sent successfully' });
    });
  });
}

app.post('/send_recovery_email', async (req, res) => {
  const { recipient_email, OTP } = req.body;

  try {
    // Check if user exists in the MySQL database
    const checkUserQuery = 'SELECT * FROM login WHERE email = ?';
    db.query(checkUserQuery, [recipient_email], (err, results) => {
      if (err) {
        console.error('Error checking user:', err);
        return res.status(500).json({ message: 'Internal server error', success: false });
      }

      if (results.length === 0) {
        return res.json({ message: 'User not found', success: false });
      }

      // Send the recovery email if the user exists
      sendEmail({ recipient_email, OTP })
        .then((response) => res.json({ message: response.message, success: true }))
        .catch((error) => res.status(500).json({ message: error.message, success: false }));
    });
  } catch (err) {
    console.error('Error in /send_recovery_email:', err);
    res.status(500).json({ message: 'Internal server error', success: false });
  }
});


app.post("/reset-password", async (req, res) => {
  const { Email, newPassword } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the MySQL database
    const updatePasswordQuery = 'UPDATE login SET password = ? WHERE email = ?';
    db.query(updatePasswordQuery, [hashedPassword, Email], (err, result) => {
      if (err) {
        console.error('Error updating password:', err);
        return res.status(500).json({ success: false, message: "Internal server error" });
      }

      if (result.affectedRows === 0) {
        return res.json({ success: false, message: "User not found" });
      }

      res.json({ success: true, message: "Password reset successfully" });
    });
  } catch (error) {
    console.error('Error in /reset-password:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


// Routes
app.post('/signup', async (req, res) => {
  const { name, email, password, gender } = req.body;
  console.log(gender);
  try {
    // Check if user already exists
    const checkUserQuery = 'SELECT * FROM login WHERE email = ?';
    db.query(checkUserQuery, [email], async (err, results) => {
      if (err) {
        console.error('Error checking user:', err);
        return res.status(500).send('Internal Server Error');
      }

      if (results.length > 0) {
        return res.status(400).send('User already exists');
      }

      // Generate unique user ID
      const generateUserId = async () => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const randomLetters = letters.charAt(Math.floor(Math.random() * letters.length)) + letters.charAt(Math.floor(Math.random() * letters.length));
        const randomNumbers = Math.floor(100 + Math.random() * 900); // 3 digit number
        const userId = randomLetters + randomNumbers;

        // Check if user ID already exists
        const checkIdQuery = 'SELECT * FROM login WHERE User_id = ?';
        return new Promise((resolve, reject) => {
          db.query(checkIdQuery, [userId], (err, results) => {
            if (err) {
              return reject(err);
            }
            if (results.length > 0) {
              resolve(generateUserId()); // Generate a new ID if it already exists
            } else {
              resolve(userId);
            }
          });
        });
      };

      const userId = await generateUserId();

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10); // Increased salt rounds for better security

      // Insert new user into the login table
      const insertLoginQuery = 'INSERT INTO login (User_id, name, email, password) VALUES (?, ?, ?, ?)';
      db.query(insertLoginQuery, [userId, name, email, hashedPassword], (err, result) => {
        if (err) {
          console.error('Error inserting data into login table:', err);
          return res.status(500).send('Internal Server Error');
        }

        // Insert into profile_details table
        const insertProfileDetailsQuery = 'INSERT INTO profile_details (User_id, name, gender) VALUES (?, ?, ?)';
        db.query(insertProfileDetailsQuery, [userId, name, gender], (err, result) => {
          if (err) {
            console.error('Error inserting profile details:', err);
            return res.status(500).send('Internal Server Error');
          }

          // Insert into career_details table
          const insertCareerDetailsQuery = 'INSERT INTO career_details (User_id) VALUES (?)';
          db.query(insertCareerDetailsQuery, [userId], (err, result) => {
            if (err) {
              console.error('Error inserting career details:', err);
              return res.status(500).send('Internal Server Error');
            }

            // Insert into lifestyle_family table
            const insertLifestyleFamilyQuery = 'INSERT INTO lifestyle_family (User_id, status) VALUES (?, ?)';
            db.query(insertLifestyleFamilyQuery, [userId, 'waiting'], (err, result) => {
              if (err) {
                console.error('Error inserting lifestyle family details:', err);
                return res.status(500).send('Internal Server Error');
              }
              
              // Insert into payment table
            const insertLifestyleFamilyQuery1 = 'INSERT INTO payment (User_id) VALUES (?)';
            db.query(insertLifestyleFamilyQuery1, [userId], (err, result) => {
              if (err) {
                console.error('Error inserting lifestyle family details:', err);
                return res.status(500).send('Internal Server Error');
              }
              res.send('Signup successful');
            });
          });
        });
      });
    });
  });
  } catch (error) {
    console.error('Error processing signup:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  try {
    const query = `
      SELECT 
        u.User_id, u.email, u.password, 
        pd.name, pd.mother_tongue, pd.marital_status, pd.dob, pd.image, pd.gender, pd.image,
        cd.highest_degree, cd.employed_in, cd.annual_income, cd.express_yourself,
        lf.family_type, lf.father_occupation, lf.mother_occupation, lf.brother, lf.sister, 
        lf.family_living_location, lf.contact_address, lf.about_family, lf.status
      FROM 
        login u
        INNER JOIN profile_details pd ON u.User_id = pd.User_id
        INNER JOIN career_details cd ON u.User_id = cd.User_id
        INNER JOIN lifestyle_family lf ON u.User_id = lf.User_id
      WHERE 
        u.email = ?
    `;

    db.query(query, [email], async (err, results) => {
      if (err) {
        console.error('Error during login:', err);
        return res.status(500).json({ msg: 'Server error' });
      }
      if (results.length === 0) {
        return res.status(400).json({ msg: 'User doesn\'t exist' });
      }

      const user = results[0];
      if (!user.password) {
        return res.status(400).json({ msg: 'Incorrect Password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Incorrect Password' });
      }

      delete user.password;
      res.json(user);
    });
  } catch (err) {
    console.error('Error during login:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

app.get('/getDetails', (req, res) => {
  const status = 'admin';
  try {
    const query = `
      SELECT 
        u.User_id, u.email, u.password, 
        pd.name, pd.mother_tongue, pd.marital_status, pd.dob, pd.image, pd.gender, pd.image,
        cd.highest_degree, cd.employed_in, cd.annual_income, cd.express_yourself,
        lf.family_type, lf.father_occupation, lf.mother_occupation, lf.brother, lf.sister, 
        lf.family_living_location, lf.contact_address, lf.about_family, lf.status, py.screenshot, py.transaction_id
      FROM 
        login u
        INNER JOIN profile_details pd ON u.User_id = pd.User_id
        INNER JOIN career_details cd ON u.User_id = cd.User_id
        INNER JOIN lifestyle_family lf ON u.User_id = lf.User_id
        INNER JOIN payment py ON u.User_id = py.User_id
      WHERE 
        lf.status != ?
    `;

    db.query(query, [status], (err, results) => {
      if (err) {
        console.error('Error during searching:', err);
        return res.status(500).json({ msg: 'Server error' });
      }

  

      if (results.length === 0) {
        return res.status(400).json({ msg: 'No Records Found.' });
      }
    
      res.json(results); // Send results instead of a non-existent user variable
    });
  } catch (err) {
    console.error('Error during searching:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});




app.post('/uploadImage',  async (req, res) => {
  const image = req.body.myfile; 
  const User_id = req.body.User_id;
  if (!image || !User_id) {
    return res.status(400).json({ msg: 'Missing image or User_id' });
  }
  const base64Length = image.length;
  const padding = (image.endsWith('==') ? 2 : (image.endsWith('=') ? 1 : 0));
  const sizeInBytes = (base64Length * 3) / 4 - padding;
  const sizeInKB = sizeInBytes / 1024;
  if(sizeInKB > 40){
    console.log('Compress', sizeInKB)
    return res.json({msg: 'Image should be less than 40KB'})
  }
  const query = 'UPDATE profile_details SET image = ? WHERE User_id = ?';

  db.query(query, [image, User_id], (err, results) => {
    if (err) {
      console.error('Error updating image:', err);
      return res.status(500).json({ msg: 'Server error' });
    }

    console.log('Image updated successfully');
    return res.json({ msg: 'Image updated successfully' });
  });
});


// Endpoint to retrieve image
app.get('/getImage', async (req, res) => {
  const User_id = req.query.User_id; // Use req.query to get query parameters
  console.log(User_id);

  if (!User_id) {
    return res.status(400).json({ msg: 'Missing User_id' });
  }

  const query = 'SELECT image FROM profile_details WHERE User_id = ?';
  console.log('Query');
  db.query(query, [User_id], (err, results) => {
    if (err) {
      console.error('Error retrieving image:', err);
      return res.status(500).json({ msg: 'Server error' });
    }

    if (results.length > 0) {
      const imageBuffer = results[0].image;

      // Send the base64 image
      return res.json({
        image: imageBuffer.toString('base64'),
        msg: 'Image retrieved successfully'
      });
    } else {
      return res.status(404).json({ msg: 'Image not found' });
    }
  });
});

app.post('/uploadPaymentImage', async (req, res) => {
  const { User_id, tid, image } = req.body;
  console.log(image)
  // Check for missing image or User_id
  if (!image || !User_id) {
    return res.json({ msg: 'Missing image or User_id' });
  }

  // Calculate image size
  const base64Length = image.length;
  const padding = (image.endsWith('==') ? 2 : (image.endsWith('=') ? 1 : 0));
  const sizeInBytes = (base64Length * 3) / 4 - padding;
  const sizeInKB = sizeInBytes / 1024;

  // Check if the image size exceeds 40KB
  if (sizeInKB > 40) {
    console.log('Compress', sizeInKB);
    return res.json({ msg: 'Image should be less than 40KB' });
  }

  // Queries
  const updateTransactionQuery = 'UPDATE payment SET transaction_id = ? WHERE User_id = ?';
  const updateScreenshotQuery = 'UPDATE payment SET screenshot = ? WHERE User_id = ?';
  const updateStatusQuery = 'UPDATE lifestyle_family SET status = ? WHERE User_id = ?';

  try {
    // Update the transaction ID
    db.query(updateTransactionQuery, [tid, User_id], (err, results) => {
      if (err) {
        console.error('Error updating transaction ID:', err);
        return res.status(500).send('Internal Server Error');
      }

      // Update the status
      db.query(updateStatusQuery, ['waiting', User_id], (err, results) => {
        if (err) {
          console.error('Error updating status:', err);
          return res.status(500).send('Internal Server Error');
        }

        // Update the screenshot
        db.query(updateScreenshotQuery, [image, User_id], (err, results) => {
          if (err) {
            console.error('Error updating screenshot:', err);
            return res.status(500).send('Internal Server Error');
          }

          // Success response
          res.send({msg:'Transaction sent successfully'});
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/updateProfileDetails', async (req, res) => {
  const { User_id, name, mother_tongue, marital_status, dob, gender } = req.body;

  try {
    const updateProfileQuery = `
      UPDATE profile_details
      SET 
        name = ?, 
        mother_tongue = ?, 
        marital_status = ?, 
        dob = ?, 
        gender = ?
      WHERE User_id = ?
    `;

    db.query(updateProfileQuery, [name, mother_tongue, marital_status, dob, gender, User_id], (err, result) => {
      if (err) {
        console.error('Error updating profile details:', err);
        return res.status(500).send('Internal Server Error');
      }
      const query = `
      SELECT 
        u.User_id, u.email, u.password, 
        pd.name, pd.mother_tongue, pd.marital_status, pd.dob, pd.image, pd.gender, pd.image,
        cd.highest_degree, cd.employed_in, cd.annual_income, cd.express_yourself,
        lf.family_type, lf.father_occupation, lf.mother_occupation, lf.brother, lf.sister, 
        lf.family_living_location, lf.contact_address, lf.about_family, lf.status
      FROM 
        login u
        INNER JOIN profile_details pd ON u.User_id = pd.User_id
        INNER JOIN career_details cd ON u.User_id = cd.User_id
        INNER JOIN lifestyle_family lf ON u.User_id = lf.User_id
      WHERE 
        u.User_id = ?
    `;

    db.query(query, [User_id], async (err, results) => {
      if (err) {
        console.error('Error during fetching:', err);
        return res.status(500).json({ msg: 'Server error' });
      }
      res.status(200).send({ message: 'Profile details updated successfully' ,updatedDetails: results[0]});
    });
    });
  } catch (error) {
    console.error('Error processing profile details update:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/updateCareerDetails', async (req, res) => {
  const { User_id, highest_degree, employed_in, annual_income, express_yourself } = req.body;

  try {
    const updateCareerQuery = `
      UPDATE career_details
      SET 
        highest_degree = ?, 
        employed_in = ?, 
        annual_income = ?, 
        express_yourself = ?
      WHERE User_id = ?
    `;

    db.query(updateCareerQuery, [highest_degree, employed_in, annual_income, express_yourself, User_id], (err, result) => {
      if (err) {
        console.error('Error updating career details:', err);
        return res.status(500).send('Internal Server Error');
      }
      const query = `
      SELECT 
        u.User_id, u.email, u.password, 
        pd.name, pd.mother_tongue, pd.marital_status, pd.dob, pd.image, pd.gender, pd.image,
        cd.highest_degree, cd.employed_in, cd.annual_income, cd.express_yourself,
        lf.family_type, lf.father_occupation, lf.mother_occupation, lf.brother, lf.sister, 
        lf.family_living_location, lf.contact_address, lf.about_family, lf.status
      FROM 
        login u
        INNER JOIN profile_details pd ON u.User_id = pd.User_id
        INNER JOIN career_details cd ON u.User_id = cd.User_id
        INNER JOIN lifestyle_family lf ON u.User_id = lf.User_id
      WHERE 
        u.User_id = ?
    `;

    db.query(query, [User_id], async (err, results) => {
      if (err) {
        console.error('Error during fetching:', err);
        return res.status(500).json({ msg: 'Server error' });
      }
      
      res.status(200).send({ message: 'Career details updated successfully' ,updatedDetails: results[0]});
    });
    });
  } catch (error) {
    console.error('Error processing career details update:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/updateFamilyDetails', async (req, res) => {
  const { User_id, family_type, father_occupation, mother_occupation, brother, sister, family_living_location, contact_address, about_family, status } = req.body;

  try {
    const updateFamilyQuery = `
      UPDATE lifestyle_family
      SET 
        family_type = ?, 
        father_occupation = ?, 
        mother_occupation = ?, 
        brother = ?, 
        sister = ?, 
        family_living_location = ?, 
        contact_address = ?, 
        about_family = ?,
        status = ?
      WHERE User_id = ?
    `;

    db.query(updateFamilyQuery, [family_type, father_occupation, mother_occupation, brother, sister, family_living_location, contact_address, about_family, status, User_id], (err, result) => {
      if (err) {
        console.error('Error updating family details:', err);
        return res.status(500).send('Internal Server Error');
      }
      const query = `
      SELECT 
        u.User_id, u.email, u.password, 
        pd.name, pd.mother_tongue, pd.marital_status, pd.dob, pd.image, pd.gender, pd.image,
        cd.highest_degree, cd.employed_in, cd.annual_income, cd.express_yourself,
        lf.family_type, lf.father_occupation, lf.mother_occupation, lf.brother, lf.sister, 
        lf.family_living_location, lf.contact_address, lf.about_family, lf.status
      FROM 
        login u
        INNER JOIN profile_details pd ON u.User_id = pd.User_id
        INNER JOIN career_details cd ON u.User_id = cd.User_id
        INNER JOIN lifestyle_family lf ON u.User_id = lf.User_id
      WHERE 
        u.User_id = ?
    `;

    db.query(query, [User_id], async (err, results) => {
      if (err) {
        console.error('Error during fetching:', err);
        return res.status(500).json({ msg: 'Server error' });
      }
      
      res.status(200).send({ message: 'Details updated successfully' ,updatedDetails: results[0]});
    });
    });
  } catch (error) {
    console.error('Error processing family details update:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/activateUser/:User_id', (req, res) => {
  const { User_id } = req.params;

  // SQL query to update the status field to 'active'
  const updateStatusQuery = 'UPDATE lifestyle_family SET status = ? WHERE User_id = ?';

  db.query(updateStatusQuery, ['active', User_id], (err, result) => {
    if (err) {
      console.error('Error activating user account:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (result.affectedRows > 0) {
      res.status(200).send({ message: 'User account activated successfully' });
    } else {
      res.status(404).send({ message: 'User not found' });
    }
  });
});

app.post('/deactivateUser/:User_id', (req, res) => {
  const { User_id } = req.params;

  // SQL query to update the status field to 'active'
  const updateStatusQuery = 'UPDATE lifestyle_family SET status = ? WHERE User_id = ?';

  db.query(updateStatusQuery, ['inactive', User_id], (err, result) => {
    if (err) {
      console.error('Error deactivating user account:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (result.affectedRows > 0) {
      res.status(200).send({ message: 'User account deactivated successfully' });
    } else {
      res.status(404).send({ message: 'User not found' });
    }
  });
});

app.post('/deleteProfile', (req, res) => {
  const { User_id } = req.body;
  console.log(req.body);
  // SQL queries to delete data from all relevant tables
  const deleteProfileQuery = 'DELETE FROM profile_details WHERE User_id = ?';
  const deleteLifestyleQuery = 'DELETE FROM lifestyle_family WHERE User_id = ?';
  const deletePaymentQuery = 'DELETE FROM payment WHERE User_id = ?';
  const deleteLoginQuery = 'DELETE FROM login WHERE User_id = ?';
  const deleteCareerDetailsQuery = 'DELETE FROM career_details WHERE User_id = ?';

  // Use a transaction to ensure atomicity
  db.beginTransaction((transactionErr) => {
    if (transactionErr) {
      return res.status(500).send('Failed to start transaction');
    }

    // Delete from profile_details
    db.query(deleteProfileQuery, [User_id], (err, result) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error deleting from profile_details:', err);
          res.status(500).send('Internal Server Error');
        });
      }

      // Delete from lifestyle_family
      db.query(deleteLifestyleQuery, [User_id], (err, result) => {
        if (err) {
          return db.rollback(() => {
            console.error('Error deleting from lifestyle_family:', err);
            res.status(500).send('Internal Server Error');
          });
        }

        // Delete from payment
        db.query(deletePaymentQuery, [User_id], (err, result) => {
          if (err) {
            return db.rollback(() => {
              console.error('Error deleting from payment:', err);
              res.status(500).send('Internal Server Error');
            });
          }

          // Delete from login
          db.query(deleteLoginQuery, [User_id], (err, result) => {
            if (err) {
              return db.rollback(() => {
                console.error('Error deleting from login:', err);
                res.status(500).send('Internal Server Error');
              });
            }

            // Delete from career_details
            db.query(deleteCareerDetailsQuery, [User_id], (err, result) => {
              if (err) {
                return db.rollback(() => {
                  console.error('Error deleting from career_details:', err);
                  res.status(500).send('Internal Server Error');
                });
              }

              // If all queries are successful, commit the transaction
              db.commit((commitErr) => {
                if (commitErr) {
                  return db.rollback(() => {
                    console.error('Error committing transaction:', commitErr);
                    res.status(500).send('Internal Server Error');
                  });
                }

                res.status(200).send({ message: 'User account deleted successfully' });
              });
            });
          });
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});