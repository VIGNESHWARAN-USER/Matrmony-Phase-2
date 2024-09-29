import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LabelList
} from 'recharts';
import Requests from './Requests';
import AdminHead from './AdminHead';

const AdminPage = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('AdminDashboard');
  const [details, setDetails] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    axios.get('https://matrimony-os38.onrender.com/getDetails')
      .then(response => {
        setDetails(response.data);
        console.log(response.data);
      })
      .catch(error => {
        console.error('Error fetching details:', error);
      });
  }, []);

  const getCounts = () => {
    const registeredUsers = details.length;
    const premiumUsers = details.filter(user => user.status === 'active').length;
    const nonPremiumUsers = details.filter(user => user.status === 'inactive').length;
    const waitlistUsers = details.filter(user => user.status === 'waiting').length;

    return [
      { name: 'Registered Users', count: registeredUsers },
      { name: 'Premium Users', count: premiumUsers },
      { name: 'Waitlist Users', count: waitlistUsers},
      { name: 'Non-Premium Users', count: nonPremiumUsers },
    ];
  };

  const getGenderCounts = () => {
    const maleCount = details.filter(user => user.gender === 'Male').length;
    const femaleCount = details.filter(user => user.gender === 'Female').length;

    return [
      { name: 'Male', count: maleCount },
      { name: 'Female', count: femaleCount },
    ];
  };

  function handleLogout() {
    localStorage.setItem('user', '');
    navigate('../login');
  }

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const filteredDetails = details.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleDelete(id) {
    try {
      // Send the request to the deleteProfile endpoint
      const response = await axios.post("http://localhost:3000/deleteProfile", { User_id: id });
      
      // Check the response and alert the message
      if (response.status === 200) {
        alert(response.data.message); // Success message from the server
      } else {
        alert("Failed to delete the user.");
      }
    } catch (error) {
      // Catch and handle any errors
      alert("An error occurred while deleting the user.");
      console.error("Error:", error);
    }
  }

  const renderTable = (filteredDetails) => (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">User ID</th>
            <th className="py-2 px-4 border-b">Name</th>
            <th className="py-2 px-4 border-b">Email</th>
            <th className="py-2 px-4 border-b">Status</th>
            <th className="py-2 px-4 border-b">Gender</th>
            <th className="py-2 px-4 border-b">Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredDetails.map(user => (
            <tr key={user.id}>
              <td className="py-2 px-4 border">{user.User_id}</td>
              <td className="py-2 px-4 border">{user.name}</td>
              <td className="py-2 px-4 border">{user.email}</td>
              <td className="py-2 px-4 border">{user.status}</td>
              <td className="py-2 px-4 border">{user.gender}</td>
              <td className="py-2 px-4 border"><button className='bg-red-500 text-white p-2 font-medium rounded-xl' onClick={()=>handleDelete(user.User_id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const sections = {
    AdminDashboard: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-14 p-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={getCounts()}>
            <XAxis dataKey="name" />
            <YAxis />
            <Legend />
            <Bar dataKey="count" fill="#8884d8">
              <LabelList dataKey="count" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={getGenderCounts()}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              label
            >
              <Cell key="Male" fill="#0088FE" />
              <Cell key="Female" fill="#FF8042" />
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    ),
    RegisteredUsers: renderTable(filteredDetails),
    PremiumUsers: renderTable(filteredDetails.filter(user => user.status === 'active')),
    NonPremiumUsers: renderTable(filteredDetails.filter(user => user.status === 'inactive')),
    Requests: (
      <div>
        <Requests user={details}/>
      </div>
    )
  };

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <AdminHead setActiveSection = {setActiveSection}/>
      <div className="bg-gray-100 flex-1 p-6 overflow-y-auto ">
        <div className="flex justify-between items-center mb-4 flex-col md:flex-row">
          <h2 className="text-2xl font-semibold mb-4 md:mb-0">{activeSection.replace(/([A-Z])/g, ' $1').trim()}</h2>
          <button onClick={handleLogout} className="bg-red-500 text-white py-2 px-4 rounded">Logout</button>
        </div>
        {activeSection !== 'AdminDashboard' && activeSection !== 'ViewDetails' && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearch}
              className="py-2 px-4 border rounded w-full md:w-1/3"
            />
          </div>
        )}
        {sections[activeSection]}
      </div>
    </div>
  );
};

export default AdminPage;
