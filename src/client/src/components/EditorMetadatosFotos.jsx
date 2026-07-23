// client/src/components/EditorMetadatosFotos.jsx
import React from 'react';

export const EditorMetadatosFotos = ({ fotos = [], onActualizarFoto, onEliminarFoto }) => {
    if (fotos.length === 0) return null;

    return (
        <div className="editor-fotos-lista gap-3 d-flex flex-column mt-3">
            <label className="form-label fw-bold">Información de las imágenes cargadas:</label>
            {fotos.map((foto, idx) => (
                <div key={foto.id || idx} className="card p-3 shadow-sm border rounded">
                    <div className="d-flex gap-3 align-items-start">
                        <div className="editor-foto-preview text-center">
                            <img
                                src={foto.url}
                                alt="Vista previa"
                                className="rounded border"
                                style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                            />
                            <button
                                type="button"
                                className="btn btn-outline-danger btn-sm mt-2 w-100"
                                onClick={() => onEliminarFoto(idx)}
                            >
                                <i className="bi bi-trash me-1"></i> Quitar
                            </button>
                        </div>

                        <div className="flex-grow-1 row g-2">
                            {/* Fecha de Captura (Obligatoria) */}
                            <div className="col-md-6">
                                <label className="form-label fs-7 fw-semibold">
                                    Fecha de captura <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={foto.fechaCaptura || ''}
                                    onChange={(e) => onActualizarFoto(idx, 'fechaCaptura', e.target.value)}
                                    required
                                />
                            </div>

                            {/* Fecha de Publicación (Solo Lectura - NOW) */}
                            <div className="col-md-6">
                                <label className="form-label fs-7 fw-semibold text-muted">
                                    Fecha de publicación
                                </label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm bg-light"
                                    value={foto.fechaPublicacion ? new Date(foto.fechaPublicacion).toLocaleDateString() : 'NOW'}
                                    disabled
                                />
                            </div>

                            {/* Quiénes Aparecen */}
                            <div className="col-md-6">
                                <label className="form-label fs-7 fw-semibold">¿Quiénes aparecen?</label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Ej: Tío Juan, María, Yo"
                                    value={foto.quienesAparecen || ''}
                                    onChange={(e) => onActualizarFoto(idx, 'quienesAparecen', e.target.value)}
                                />
                            </div>

                            {/* Lugar */}
                            <div className="col-md-6">
                                <label className="form-label fs-7 fw-semibold">Lugar de la toma</label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Ej: Guadalajara, Jalisco"
                                    value={foto.lugar || ''}
                                    onChange={(e) => onActualizarFoto(idx, 'lugar', e.target.value)}
                                />
                            </div>

                            {/* Descripción */}
                            <div className="col-12">
                                <label className="form-label fs-7 fw-semibold">Descripción o mensaje</label>
                                <textarea
                                    className="form-control form-control-sm"
                                    rows="2"
                                    placeholder="Añade un recuerdo o mensaje sobre esta foto..."
                                    value={foto.descripcion || ''}
                                    onChange={(e) => onActualizarFoto(idx, 'descripcion', e.target.value)}
                                ></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};