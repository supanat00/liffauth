'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

import artists from '../../../public/artist.json';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10; // Default page size
  const [sumByArtist, setSumByArtist] = useState<any[]>([]);
  const [saveShareByArtist, setSaveShareByArtist] = useState<any[]>([]);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const response = await fetch(`/api/getTransactions?page=${currentPage}&limit=${pageSize}`);
        const data = await response.json();

        setTransactions(data.data);
        setTotalPages(data.totalPages);
        setSumByArtist(data.sumByArtist);
        setSaveShareByArtist(data.saveShareByArtist);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
    }

    fetchTransactions();
  }, [currentPage]);

  // **Export to Excel Function**
  const exportToExcel = () => {
    const worksheetData = transactions.map((tx) => ({
      Date: new Date(tx.date).toLocaleDateString(),
      "Total User": tx.totalRows,
      "Unique User": tx.uniqueUsers,
      "Total User Save & Share": tx.totalSaveAndShare,
      ...Object.fromEntries(
        artists.map(artist => [
          `Total User ${artist.artistName}`, 
          sumByArtist.find(a => a.artistId === artist.artistId)?.totalRows || 0
        ])
      ),
      ...Object.fromEntries(
        artists.map(artist => [
          `Total User Save & Share ${artist.artistName}`, 
          saveShareByArtist.find(a => a.artistId === artist.artistId)?.totalSaveAndShare || 0
        ])
      ),
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, `Transactions_${new Date().toISOString()}.xlsx`);
  };

  return (
    <div className='min-h-screen bg-gray-100 p-6 flex flex-col items-center'>
      <div className='w-full bg-white shadow-md rounded-lg p-6'>
        <h1 className='text-2xl font-semibold text-gray-800 mb-6 text-center'>Transaction Records</h1>

        {/* Export Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700"
          >
            Export to Excel
          </button>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full border border-gray-300 rounded-lg shadow-sm'>
            <thead className='bg-gray-800 text-white text-sm uppercase'>
              <tr>
                <th className='border border-gray-300 px-4 py-3 text-left'>Date</th>
                <th className='border border-gray-300 px-4 py-3 text-center'>Total User</th>
                <th className='border border-gray-300 px-4 py-3 text-center'>Unique User</th>
                <th className='border border-gray-300 px-4 py-3 text-center'>Total User Save & Share</th>
                {artists.map((artist) => (
                  <>
                    <th key={`artist-${artist.artistId}`} className='border border-gray-300 px-4 py-3 text-center'>
                      Total User {artist.artistName}
                    </th>
                    <th key={`save-artist-${artist.artistId}`} className='border border-gray-300 px-4 py-3 text-center'>
                      Total User Save & Share {artist.artistName}
                    </th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody className='text-gray-700'>
              {transactions.length > 0 ? (
                transactions.map((tx, index) => (
                  <tr key={index} className='bg-white border-b hover:bg-gray-50'>
                    <td className='border border-gray-300 px-4 py-3'>{new Date(tx.date).toLocaleString()}</td>
                    <td className='border border-gray-300 px-4 py-3 text-center'>{tx.totalRows}</td>
                    <td className='border border-gray-300 px-4 py-3 text-center'>{tx.uniqueUsers}</td>
                    <td className='border border-gray-300 px-4 py-3 text-center'>{tx.totalSaveAndShare}</td>
                    {artists.map((artist) => (
                      <>
                        <td key={`artist-${artist.artistId}`} className='border border-gray-300 px-4 py-3 text-center'>
                          {sumByArtist.find(a => a.artistId === artist.artistId)?.totalRows || 0}
                        </td>
                        <td key={`save-artist-${artist.artistId}`} className='border border-gray-300 px-4 py-3 text-center'>
                          {saveShareByArtist.find(a => a.artistId === artist.artistId)?.totalSaveAndShare || 0}
                        </td>
                      </>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={30} className='border border-gray-300 px-4 py-3 text-center text-gray-500'>
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className='flex justify-between mt-4'>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className='px-4 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50'
          >
            Previous
          </button>

          <span className='text-gray-800 font-semibold'>
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className='px-4 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50'
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
