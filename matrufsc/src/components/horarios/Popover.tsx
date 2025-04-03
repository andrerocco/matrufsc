// import { useState } from "react";
// import { usePlanoStore } from "~/providers/plano/store";

// export default function Popover({ onClose }: { onClose: () => void }) {
//     const setCompromissoTitulo = usePlanoStore((state) => state.setCompromissoTitulo);
//     const applyTempSelections = usePlanoStore((state) => state.applyTempSelections);
//     const stopSelecting = usePlanoStore((state) => state.stopSelecting);
//     const [titulo, setTitulo] = useState("");

//     const handleCancel = () => {
//         stopSelecting();
//         onClose();
//     };

//     const handleAdd = () => {
//         applyTempSelections();
//         onClose();
//     };

//     const handleTituloChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//         setTitulo(e.target.value);
//         setCompromissoTitulo(e.target.value);
//     };

//     return (
//         <div className="absolute left-full top-0 ml-4 w-80">
//             <div className="rounded-lg border border-neutral-300 bg-white p-4 shadow-lg">
//                 <div className="mb-4 flex items-center justify-between">
//                     <h2 className="text-lg font-bold">Adicionar Compromisso</h2>
//                     <button
//                         onClick={handleCancel}
//                         className="text-lg text-neutral-500 hover:text-neutral-800"
//                     >
//                         ×
//                     </button>
//                 </div>
//                 <div className="space-y-4">
//                     <div>
//                         <label className="block text-sm font-medium text-neutral-600">
//                             Título
//                         </label>
//                         <input
//                             type="text"
//                             className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-neutral-500 focus:outline-none"
//                             value={titulo}
//                             maxLength={10}
//                             onChange={handleTituloChange}
//                         />
//                     </div>
//                 </div>
//                 <div className="flex justify-between mt-4">
//                     <button
//                         className="bg-gray-300 text-black py-2 rounded w-5/12"
//                         onClick={handleCancel}
//                     >
//                         Cancelar
//                     </button>
//                     <button
//                         className="bg-blue-500 text-white py-2 rounded w-5/12"
//                         onClick={handleAdd}
//                     >
//                         Adicionar
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// }
